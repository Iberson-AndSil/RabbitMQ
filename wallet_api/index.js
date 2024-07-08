const express = require("express");
const ampq = require("amqplib"); 
// const walletService = require("./services/walletService");
const uri = 'mongodb+srv://silvaiberson3:iberson123@cluster0.j8pegzx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'

const mongoose = require('mongoose');
mongoose.connect(uri);

const app = express()
app.use( express.json() )
const port = 8081
const { walletModel } = require('./models');

app.get('/wallet', async(req, res)=>{
    const list = await walletModel.find({});
    res.json( list );
});

app.post('/wallet', async(req, res)=>{
    try {
        const {userDni, message} = req.body
        const model = new walletModel({userDni, message});
        console.log(`recibido... ${userDni}`);

        const data = await model.save();
        return res.status(201).json(data);

    } catch (error) {
        console.log('Error', error);
    return res.status(500).json({ message: 'Internal server error' });
    }
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})