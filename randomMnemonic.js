const ethers = require('ethers');

// All createRandom Wallets are generated from random mnemonics
let wallet = ethers.Wallet.createRandom();
let randomMnemonic = wallet.mnemonic;

console.log(randomMnemonic)