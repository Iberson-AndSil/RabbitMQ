const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    dni: {
        type: String,
        required: true
    },
    name: {
      type: String,
      required: true
    },
    mensaje: {
        type: String,
        required: true
    },
    saldoApuesta:
    {
      type: Number,
      required:true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });

  module.exports = {userSchema}