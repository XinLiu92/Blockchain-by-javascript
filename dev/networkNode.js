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
	const blockIndex = bitcoin.createNewTransaction(req.body.amount,req.body.sender,req.body.recipient);
   	// console.log(blockIndex)
	res.json({note: `transaction will be added in block ${blockIndex}.`});

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

	res.json({
		note: "new block mined successfully",
		block : newBlock
	})

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

app.listen(port,function(){
	console.log(`Listening on port ${port}...`)
});