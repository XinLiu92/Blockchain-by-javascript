const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const Blockchain = require('./blockchain');
const uuid = require('uuid/v1');

const port = process.argv[2];


const rp = require('request-promise');

const bitcoin = new Blockchain();

const nodeAddress = uuid().split('-').join('');

//inorder to access response 
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));


app.get('/blockchain',function(req,res){
	res.send(bitcoin);

});


app.post('/transaction',function(req,res){

	const newTransaction = req.body;

	const blockIndex = bitcoin.addTransactionToPendingTransactions(newTransaction);

	res.json({note: `transaction will be added in block ${blockIndex}.`});



});


app.post('/transaction/broadcast',function(req,res){
	// const newTransaction = bitcoin.createNewTransaction(req.body.amount,req.body.sender,req.body.recipient);

	// bitcoin.addTransactionToPendingTransactions(newTransaction);
	// const requestPromises = [];
	// //broadcast
	// bitcoin.networkNodes.forEach(networkNodeUrl =>{
	// 	const requestOptions = {
	// 		uri:networkNodeUrl + 'transaction',
	// 		method: 'POST',
	// 		body: newTransaction,
	// 		json: true
	// 	};
	// 	requestPromises.push(rp(requestOptions));
		
	// });
	// Promise.all(requestPromises)
	// .then(data=>{
	// 	 res.json({note: 'Tansaction created and broadcast successfully'});
	// });
	const newTransaction = bitcoin.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);
	bitcoin.addTransactionToPendingTransactions(newTransaction);

	const requestPromises = [];
	bitcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/transaction',
			method: 'POST',
			body: newTransaction,
			json: true
		};

		requestPromises.push(rp(requestOptions));
	});

	Promise.all(requestPromises)
	.then(data => {
		res.json({ note: 'Transaction created and broadcast successfully.' });
	});


});

//create a new block
app.get('/mine',function(req,res){
	const lastBlock = bitcoin.getLastBlock();
	const previousBlockHash = lastBlock['hash'];

	const currentBlockData = {
		transactions : bitcoin.pendingTransactions,
		index: lastBlock['index'] + 1
	}
	const nonce = bitcoin.proofOfWork(previousBlockHash,currentBlockData);

	const blockHash = bitcoin.hashBlock(previousBlockHash,currentBlockData,nonce);

	//"00" is reward for mining
	bitcoin.createNewTransaction(12.5,"00", nodeAddress)

	const newBlock = bitcoin.createNewBlock(nonce,previousBlockHash,blockHash);

	const requestPromises = [];
	bitcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/receive-new-block',
			method: 'POST',
			body: { newBlock: newBlock },
			json: true
		};

		requestPromises.push(rp(requestOptions));
	});

	Promise.all(requestPromises)
	.then(data => {
		const requestOptions = {
			uri: bitcoin.currentNodeUrl + '/transaction/broadcast',
			method: 'POST',
			body: {
				amount: 12.5,
				sender: "00",
				recipient: nodeAddress
			},
			json: true
		};

		return rp(requestOptions);
	})
	.then(data => {
		res.json({
			note: "New block mined & broadcast successfully",
			block: newBlock
		});
	});

});

// receive new block
app.post('/receive-new-block', function(req, res) {
	const newBlock = req.body.newBlock;
	const lastBlock = bitcoin.getLastBlock();
	const correctHash = lastBlock.hash === newBlock.previousBlockHash; 
	const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

	if (correctHash && correctIndex) {
		bitcoin.chain.push(newBlock);
		bitcoin.pendingTransactions = [];
		res.json({
			note: 'New block received and accepted.',
			newBlock: newBlock
		});
	} else {
		res.json({
			note: 'New block rejected.',
			newBlock: newBlock
		});
	}
});

//regist a node and broadcast to the whole network

app.post('/register-and-broadcast-node',function(req,res){
	const newNodeUrl = req.body.newNodeUrl;
	if (bitcoin.networkNodes.indexOf(newNodeUrl) == -1) bitcoin.networkNodes.push(newNodeUrl);

	const regNodesPromises = [];
	bitcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/register-node',
			method: 'POST',
			body: { newNodeUrl: newNodeUrl },
			json: true
		};

		regNodesPromises.push(rp(requestOptions));
	});

	Promise.all(regNodesPromises)
	.then(data => {
		const bulkRegisterOptions = {
			uri: newNodeUrl + '/register-nodes-bulk',
			method: 'POST',
			body: { allNetworkNodes: [ ...bitcoin.networkNodes, bitcoin.currentNodeUrl ] },
			json: true
		};

		return rp(bulkRegisterOptions);
	})
	.then(data => {
		res.json({ note: 'New node registered with network successfully.' });
	});
	// const newNodeUrl = req.body.newNodeUrl;

	// if(bitcoin.networkNodes.indexOf(newNodeUrl) == -1) {
	// 	bitcoin.networkNodes.push(newNodeUrl);
	// }

	// const regNodesPromises = [];
	// //BROADCAST

	// bitcoin.networkNodes.forEach(networkNodeUrl => {
	// 	//register-node

	// 	//request to differenece node
	// 	const requestOptions = {
	// 		uri : networkNodeUrl + '/regist-node',
	// 		method : 'POST',
	// 		body : {
	// 			newNodeUrl:newNodeUrl
	// 		},

	// 		json: true

	// 	};

	// 	regNodesPromises.push(rp(requestOptions));

	// });

	// Promise.all(regNodesPromises)
	// .then(data => {
	// 	//regist back 

	// 	const bulkRegisterOptions = {
	// 		uri: newNodeUrl + '/regist-node-bulk',
	// 		method: 'POST',
	// 		body : { allNetworkNodes: [ ...bitcoin.networkNodes,bitcoin.currentNodeUrl] },
	// 		json : true
	// 	};

	// 	return rp(bulkRegisterOptions);

	// })
	// .then(data => {
	// 	res.json({note: 'new node registed with network successfully '});
	// });

});

//no broadcast only regist
app.post('/register-node',function(req,res){
	const newNodeUrl = req.body.newNodeUrl;
	const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(newNodeUrl) == -1;
	const notCurrentNode = bitcoin.currentNodeUrl !== newNodeUrl;
	if (nodeNotAlreadyPresent && notCurrentNode) {
		bitcoin.networkNodes.push(newNodeUrl);
	}
	
	res.json({note: 'new node registered successfually'});

});

//regist multiple nodes at once
app.post('/register-nodes-bulk',function(req,res){
	//assume all network url in our array

	const allNetworkNodes = req.body.allNetworkNodes;

	allNetworkNodes.forEach(networkNodeUrl =>{

		const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(networkNodeUrl) == -1;
		const notCurrentNode = bitcoin.currentNodeUrl !== networkNodeUrl;
		if (nodeNotAlreadyPresent && notCurrentNode) {
			bitcoin.networkNodes.push(networkNodeUrl);
		}
		
	});

	res.json({note: 'bulk registration successful'});
});


// consensus
app.get('/consensus', function(req, res) {
	const requestPromises = [];
	bitcoin.networkNodes.forEach(networkNodeUrl => {
		const requestOptions = {
			uri: networkNodeUrl + '/blockchain',
			method: 'GET',
			json: true
		};

		requestPromises.push(rp(requestOptions));
	});

	Promise.all(requestPromises)
	.then(blockchains => {
		const currentChainLength = bitcoin.chain.length;
		let maxChainLength = currentChainLength;
		let newLongestChain = null;
		let newPendingTransactions = null;

		blockchains.forEach(blockchain => {
			if (blockchain.chain.length > maxChainLength) {
				maxChainLength = blockchain.chain.length;
				newLongestChain = blockchain.chain;
				newPendingTransactions = blockchain.pendingTransactions;
			};
		});


		if (!newLongestChain || (newLongestChain && !bitcoin.chainIsValid(newLongestChain))) {
			res.json({
				note: 'Current chain has not been replaced.',
				chain: bitcoin.chain
			});
		}
		else {
			bitcoin.chain = newLongestChain;
			bitcoin.pendingTransactions = newPendingTransactions;
			res.json({
				note: 'This chain has been replaced.',
				chain: bitcoin.chain
			});
		}
	});
});

// get block by blockHash
app.get('/block/:blockHash', function(req, res) { 
	const blockHash = req.params.blockHash;
	const correctBlock = bitcoin.getBlock(blockHash);
	res.json({
		block: correctBlock
	});
});


// get transaction by transactionId
app.get('/transaction/:transactionId', function(req, res) {
	const transactionId = req.params.transactionId;
	const trasactionData = bitcoin.getTransaction(transactionId);
	res.json({
		transaction: trasactionData.transaction,
		block: trasactionData.block
	});
});


// get address by address
app.get('/address/:address', function(req, res) {
	const address = req.params.address;
	const addressData = bitcoin.getAddressData(address);
	res.json({
		addressData: addressData
	});
});





app.listen(port,function(){
	console.log(`Listening on port ${port}...`)
});