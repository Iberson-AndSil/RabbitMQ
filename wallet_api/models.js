const mongoose = require('mongoose');
const { walletSchema } = require('./schemas');

const walletModel = mongoose.model('wallet', walletSchema);

module.exports = {walletModel};