const mongoose = require('mongoose');
const { userSchema } = require('./schemas');

const userModel = mongoose.model('user', userSchema);

module.exports = {userModel};