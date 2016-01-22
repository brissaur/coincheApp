var MongoClient = 	('mongodb').MongoClient;
var url = 'mongodb://localhost:27017/test';
var CARD_COLLECTION = 'cards';

var assert = require('assert');
var Deck = require(__dirname +'/deck');
var games = {};
var invites = {};

var MAXPLAYER=2;

// ==============================================================
// ================== INVITATIONS ===================================
// ==============================================================
exports.invite = invite;
function invite(players){
	var inviteID = getNewAvailableGameId();
	console.log('invite ' + inviteID + ' for '+ players);
	//TODO: set Timeout!!!!!
	// assert(!invites[inviteID]);
	invites[inviteID] = [];
	players.forEach(function(player){
			// console.log(player);
		invites[inviteID][player] = false;
	})
	return inviteID;
}
exports.accept = accept;
function accept(inviteID, player){
	console.log('invite ' + inviteID + ' ACCEPTED by' +player);
	assert(invites[inviteID]);
		// console.log(invites[inviteID]);
	assert(invites[inviteID][player]!=null);
	invites[inviteID][player] = true;
}
exports.refuse = refuse;
function refuse(inviteID, player){
	console.log('invite ' + inviteID + ' REFUSED by ' +player);
	assert(invites[inviteID]);
	assert(invites[inviteID][player]!=null);
	delete invites[inviteID];
	// est ce quon renvoit les players?
}
exports.readyToStart = readyToStart;
function readyToStart(inviteID){
	assert(invites[inviteID]);
	assert(invites[inviteID]);
	var gameMustStart = true;
	invites[inviteID].forEach(function (hasAccepted){
		gameMustStart = gameMustStart && hasAccepted;
	});
	return gameMustStart;
}

// ==============================================================
// ================== GAME ===================================
// ==============================================================
exports.init = init;
function init(gameID, callback){
	assert(invites[gameID]);
	assert(readyToStart(gameID));
	var players = [];
	for (player in invites[gameID]){
		players.push(player);
	}
	callback(new Game(gameID, players));
}
// exports.init = init;
// exports.newGame = newGame;
// function newGame(players){
// 	var g = new Game(players);
// 	games[g.id] = g;
// 	return g;
// }
exports.game = game;
function game(gameID){
	return games[gameID];
}
// exports.getNewAvailableGameId = getNewAvailableGameId;
function getNewAvailableGameId(){
	return Math.floor((Math.random() * 1000));
}
// exports.getNewAvailableGameId = getNewAvailableGameId;
function setNewAvailableGameId(gameID){
	//
}
function Game(id, players){
	if (games[id]) return null;
	games[id]=this;

	this.gameID=id;
	this.playersIndexes=players;//players[i]=pName;
	this.players = {};
	for(index in players){
		this.players[players[index]]={};
	}
	this.nbPlayers=players.length;

	rand=Math.floor((Math.random() * this.nbPlayers));
	
	this.deck=Deck.newDeck();
	this.namespace=null;
	this.currentDealer=rand;
	this.currentPlayer=(rand+1)%this.nbPlayers;
	this.firstTrickPlayer=(rand+1)%this.nbPlayers;
	this.deck=Deck.newDeck();
	this.deck.shuffle();

	this.start = function(callback){
		this.distribute();
		callback();
	}

	this.distribute = function(callback){
		// console.log('///////////DISTRIBUTE/////////');
		var cards = this.deck.distribute();
		// console.log('cards=' + cards);
		// assert(cards.length==this.playersIndexes.length);//2!=4 for test
		var len = this.playersIndexes.length;//cards.length 
		// console.log('len=' + len);
		for (var i = 0; i < len; i++) {
			// console.log('loop: ' + cards[i]);
			this.players[this.playersIndexes[i]].cards = cards[i];
		};
		// console.log(this.players);
		// console.log('////////////////////');
	}

	// cards=thisRoom.deck.distribute();
}