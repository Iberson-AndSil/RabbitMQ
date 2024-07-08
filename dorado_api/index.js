const express = require('express');
const app = express();
const axios = require('axios');
app.use(express.json());
const port = 8080;

const mongoose = require('mongoose');
const uri = 'mongodb+srv://silvaiberson3:iberson123@cluster0.j8pegzx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(uri);

const { userModel } = require('./models');
const amqp = require('amqplib');

const exchange = 'apuestas_exchange';
const rabbitSettings = {
    protocol: 'amqp',
    hostname: 'localhost',
    port: 5672,
    username: 'Iberson',
    password: 'iberson123',
    vhost: '/',
    authMechanism: ['PLAIN', 'AMQPLAIN', 'EXTERNAL']
};

app.get('/user', async (req, res) => {
    const user = await userModel.find({});
    res.json(user);
});

// Define los nombres de varias colas con diferentes retrasos (1m, 10m, 1h, 1d) y una cola final...
const queue1m = 'apuestas_delayed_1m';
const queue10m = 'apuestas_delayed_10m';
const queue1h = 'apuestas_delayed_1h';
const queue1d = 'apuestas_delayed_1d';
const finalQueue = 'apuestas';

async function verificarEstadowalletApi() {
    try {
        const respuesta = await axios.get('http://localhost:8081/wallet');
        return respuesta.data.estado === 'activo';
    } catch (error) {
        console.error('wallet_api inactivo:', error.message);
        return false;
    }
}

async function sendToQueue() {
    let conn;
    try {
        conn = await amqp.connect(rabbitSettings);
        console.log("Conexión creada...");
        const channel = await conn.createChannel();
        console.log("Canal creado...");

        await channel.assertExchange(exchange, 'direct', { durable: true });

        await channel.assertQueue(queue1m, {
            durable: true,
            arguments: {
                'x-message-ttl': 60000,
                'x-dead-letter-exchange': exchange,
                'x-dead-letter-routing-key': 'apuestas_10m'
            }
        });

        await channel.assertQueue(queue10m, {
            durable: true,
            arguments: {
                'x-message-ttl': 600000,
                'x-dead-letter-exchange': exchange,
                'x-dead-letter-routing-key': 'apuestas_1h'
            }
        });

        await channel.assertQueue(queue1h, {
            durable: true,
            arguments: {
                'x-message-ttl': 3600000,
                'x-dead-letter-exchange': exchange,
                'x-dead-letter-routing-key': 'apuestas_1d'
            }
        });

        await channel.assertQueue(queue1d, {
            durable: true,
            arguments: {
                'x-message-ttl': 86400000,
                'x-dead-letter-exchange': exchange,
                'x-dead-letter-routing-key': 'apuestas'
            }
        });

        await channel.assertQueue(finalQueue, { durable: true });

        await channel.bindQueue(queue1m, exchange, 'apuestas_1m');
        await channel.bindQueue(queue10m, exchange, 'apuestas_10m');
        await channel.bindQueue(queue1h, exchange, 'apuestas_1h');
        await channel.bindQueue(queue1d, exchange, 'apuestas_1d');
        await channel.bindQueue(finalQueue, exchange, 'USUARIO');

        await monitorQueues(channel);

        return channel;

    } catch (error) {
        console.error('Error al enviar mensaje a la cola:', error.message);
        if (conn) {
            conn.close();
        }
        throw error;
    }
}

async function monitorQueues(channel) {
    const queues = [queue1m, queue10m, queue1h, queue1d, finalQueue];
    for (const queue of queues) {
        await channel.consume(queue, async (msg) => {
            if (msg !== null) {
                console.log(`Mensaje recibido en la cola ${queue}: ${msg.content.toString()}`);

                const messageContent = JSON.parse(msg.content.toString());
                try {
                    const response = await axios.post('http://localhost:8081/wallet', {
                        message: messageContent.mensaje,
                        userDni: messageContent.dni
                    });
                    console.log(`Respuesta de la API de wallet para ${queue}:`, response.data);
                    channel.ack(msg);
                    console.log("Mensaje eliminado");
                } catch (error) {
                    console.error(`Error al llamar a la API de wallet para la cola ${queue}:`, error.message);
                }
            }
        });
    }
}

app.post('/user', async (req, res) => {
    const { dni, name, mensaje, saldoApuesta } = req.body;

    try {
        const user = new userModel({ dni, name, mensaje, saldoApuesta });
        const data = await user.save();

        const channel = await sendToQueue();

        try {
            const walletApiActivo = await verificarEstadowalletApi();

            if (walletApiActivo) {
                // Si wallet_api está activo, procesa directamente la apuesta
                const response = await axios.post('http://localhost:8081/wallet', {
                    message: user.mensaje,
                    userDni: user.dni
                });

                res.send('Apuesta realizada directamente');
            } else {
                // Si wallet_api está inactivo, encola la apuesta
                console.log(`Apuesta enviada a la cola: mensaje: ${user.mensaje}, DNI: ${user.dni}`);
                await channel.publish(exchange, 'apuestas_1m', Buffer.from(JSON.stringify(user)));
                res.send('Apuesta encolada para procesamiento futuro');
            }

        } catch (error) {
            console.error('Error en la llamada a la API de wallet:', error.message);
            res.status(500).json({ error: 'Error al procesar la apuesta' });
        }

    } catch (error) {
        console.error('Error al guardar el usuario en la base de datos:', error.message);
        res.status(500).json({ message: 'Error al guardar el usuario en la base de datos' });
    }
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
