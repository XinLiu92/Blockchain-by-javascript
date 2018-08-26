const Blockchain  = require('./blockchain')

const bitcoin = new Blockchain();

bitcoin.createNewBlock(212213,'asd','asdw');

bitcoin.createNewTransaction(100,'wade-asd','james-asdw');

const previousBlockHash = 'asdaasdfsfdsfdsfs';
const currentBlockData = [
	{
		amount:10,
		sender : 'asfdsfsd',
		recipient : 'asfdsfsdfxz'
	},
	{
		amount:101,
		sender : 'asasfdsfsd',
		recipient : 'vasfdsfsdfxz'
	},
	{
		amount:1021,
		sender : 'asasfdsfsd',
		recipient : 'afdssfdsfsdfxz'
	}
];
bitcoin.proofOfWork(previousBlockHash,currentBlockData);

//console.log(bitcoin.proofOfWork(previousBlockHash,currentBlockData));
console.log(bitcoin.hashBlock(previousBlockHash,currentBlockData,99123) );