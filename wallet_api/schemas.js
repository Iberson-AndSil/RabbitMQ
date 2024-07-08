const mongoose = require('mongoose');
const walletSchema = new mongoose.Schema({
    userDni: {
        type: String,
        required: true
    },
    message: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });

  module.exports = {walletSchema}