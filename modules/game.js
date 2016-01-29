var MongoClient = 	('mongodb').MongoClient;
var url = 'mongodb://localhost:27017/test';
var CARD_COLLECTION = 'cards';

var assert = require('assert');
var Deck = require(__dirname +'/deck');
var Cards = require(__dirname +'/cards').template();
var games = {};
var invites = {};

var MAXPLAYER=2;
var AUTHORIZEDCARDS=['7H','8H','9H','10H','JH','QH','KH','AH','7D','8D','9D','10D','JD','QD','KD','AD','7S','8S','9S','10S','JS','QS','KS','AS','7C','8C','9C','10C','JC','QC','KC','AC'];

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
	var gameMustStart = true;
	for (index in invites[inviteID]){
		gameMustStart = gameMustStart && invites[inviteID][index];
		
	}
	return gameMustStart;
}

// ==============================================================
// ================== GAME ADMIN===================================
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
	//TODO: add team numbers 0 / 1
	this.nbPlayers=players.length;

	rand=Math.floor((Math.random() * this.nbPlayers));
	
	this.deck=Deck.newDeck();
	this.namespace=null;
	this.currentDealer=rand;
	this.currentPlayer=(rand+1)%this.nbPlayers;
	this.firstTrickPlayer=(rand+1)%this.nbPlayers;
	this.deck=Deck.newDeck();
	this.deck.shuffle();
	this.scores = [{match:0, game:0},{match:0, game:0}];
	this.currentTrickIndex = 0;
	this.currentTrick=[];
	this.lastTrick=[];
	this.currentTrump = '';
	this.currentAnnounce = {color:'', value:0};

	this.nextJetee = function(callback){//callback()
		this.distribute();
		this.currentTrump = '';//TODO
		this.currentAnnounce = {color:'', value:0};
		console.log({dealer: this.currentDealer, firstPlayer: this.firstTrickPlayer})
		callback();
	}

	this.distribute = function(callback){
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
// ==============================================================
// ================== GAME RULES ===================================
// ==============================================================
//When a player plays a card
	this.announce = function(name, value, color, callback){
  		assert(this.playersIndexes.indexOf(name)!=-1);
  		assert(this.playersIndexes.indexOf(name)===this.currentPlayer);

  		assert((parseInt(value) > parseInt(this.currentAnnounce.value)) || value == 0, 'new announce not greater or pass ' + value + ' !> ' + this.currentAnnounce.value);

  		if (value == 0 && ((this.currentPlayer+1)%this.nbPlayers)==this.firstTrickPlayer ){
  			var announce = {name: this.playersIndexes[this.firstTrickPlayer], value:this.currentAnnounce.value, color:this.currentAnnounce.color}
  			this.firstTrickPlayer = (this.currentDealer+1)%this.nbPlayers;
  			this.currentPlayer = this.firstTrickPlayer;
  			this.currentTrump = this.currentAnnounce.color;
			return callback (null, announce);
  		}
  		if (value != 0){
  			this.firstTrickPlayer=this.currentPlayer;
  			this.currentAnnounce.value = value;
  			this.currentAnnounce.color = color;
  		}

  		this.currentPlayer=(this.currentPlayer+1)%this.nbPlayers;
  		return callback(null, null);

  		// if (this.currentPlayer=this.firstTrickPlayer){//fin des annonces
  		// }
	}
	this.coinche = function (){

	}

	this.play = function(name, card, callback){//callback(endTrick)
  		assert(this.playersIndexes.indexOf(name)!=-1);
  		assert(this.playersIndexes.indexOf(name)===this.currentPlayer);

  		assert(AUTHORIZEDCARDS.indexOf(card)!=-1, 'AUTHORIZEDCARDS.indexOf(card): ' + AUTHORIZEDCARDS.indexOf(card) +' ' + card);
  		//remove played card from hand
  		var cardIndex = this.players[name].cards.indexOf(card);
  		assert(cardIndex!=-1, 'User played '+card+' but available cards should be '+ this.players[name].cards);
  		this.players[name].cards.splice(cardIndex, 1);
		
		this.currentTrick.push(card);//TODO : order 
		// console.log('card ' + card + ' pushed in ' + this.currentTrick);
		// var endTrick = this.firstTrickPlayer==((this.currentPlayer+1)%this.nbPlayers);
		var endTrick = this.currentTrick.length == this.nbPlayers;
		if (endTrick) {
			this.endTrick(callback);
		} else {
			this.currentPlayer=(this.currentPlayer+1)%this.nbPlayers;
  			callback(false, false, false);
		}
	}

	this.endTrick = function(callback){
		var endJetee = this.currentTrickIndex == 7;
		if (endJetee) {
			this.endJetee(callback);
		} else {
			// console.log((this.trickWinner()+this.firstTrickPlayer)%this.nbPlayers + '-' + this.trickWinner()+ '-'+this.firstTrickPlayer+ '-' +this.nbPlayers);
			this.currentPlayer = (this.trickWinner()+this.firstTrickPlayer)%this.nbPlayers;
			// console.log('THIS.FTPLAYER= ' + (this.trickWinner()+this.firstTrickPlayer)%this.nbPlayers);
			this.lastTrick = this.currentTrick;
			this.currentTrickIndex++;
			// this.currentPlayer = Math.floor((Math.random() * this.nbPlayers));//TODO EVOL: calculé quia  gagné le pli
			this.firstTrickPlayer = this.currentPlayer;
			callback(true, false, false);
		}
		this.currentTrick = [];
	}

	this.endJetee = function(callback){
		var endMatch = (this.scores[0].match >=2000 || this.scores[1].match >=2000);
		//compter les points
		if (endMatch){
			this.endMatch(callback);
		} else {

		}
		this.currentDealer = (this.currentDealer + 1)%this.nbPlayers;
		this.firstTrickPlayer = (this.currentDealer + 1)%this.nbPlayers;
		this.currentPlayer = this.firstTrickPlayer;
		this.distribute();
		this.lastTrick = [];
		this.currentTrickIndex = 0;
		this.currentTrump = '';
		this.currentAnnounce = {color:'', value:0};
		console.log({dealer: this.currentDealer, firstPlayer: this.firstTrickPlayer})
		callback(true, true, false);

	}
	this.endMatch = function(callback){
		//compter les points
		this.scores[0].match = 0;
		this.scores[0].game++;
		this.scores[1].match = 0;
		this.scores[1].game++;
		callback(true, true, true);
	}

	this.playableCards = function(){
		// console.log('PLAYABLE CARDS...');
		var thisPlayer = this.players[this.playersIndexes[this.currentPlayer]];
		//IF IM FIRST TO PLAY
		if (this.firstToPlay()) return thisPlayer.cards;
		// console.log('NOT FIRST...');

		var colorPlayedCards = cardsOfColor(thisPlayer.cards,this.colorPlayed());
		//IF I HAVE THE COLOR
		if (colorPlayedCards.length > 0){
			// console.log('I HAVE THE COLOR...');
			if (this.colorPlayed()==this.currentTrump){
				// console.log('WHICH IS TRUMP..');
				return manageTrumps(this.currentTrick, thisPlayer.cards, this.currentTrump);
			}
			// console.log('WHICH IS NOT TRUMP..');
			return colorPlayedCards;
		}
		// console.log('NOT INITIAL COLOR...');
		//IF I DO NOT HAVE THE COLOR
		//IF MY PARTNER IS WINNING
		if (this.partnerIsWinning()) return thisPlayer.cards;
		// console.log('NOT PARTNER WINNING...');
		//I MUST TRUMP
		var trumpPlayedCards = cardsOfColor(thisPlayer.cards,this.currentTrump);
		if(trumpPlayedCards.length>0){
			return manageTrumps(this.currentTrick, thisPlayer.cards, this.currentTrump);
		}
		// console.log('NO TRUMPS...');
		return thisPlayer.cards;
	}
	
	this.colorPlayed = function(){
		// assert(this.currentTrick[0]);
		if (!this.currentTrick[0])  return 'FIRST PLAYER';
		return Cards[this.currentTrick[0]].color;
	}

	this.firstToPlay = function(){
		return this.currentTrick.length == 0;
	}

	this.partnerIsWinning = function(){ //ROBINROBINROBIN
		var len = this.currentTrick.length;
		if (len >=2){
			return this.trickWinner() == this.currentTrick[len-2];//TODO
		}
		return false;
	}

	this.trickWinner = function(){
		var trump = false;
		var max = 0;
		var winnerIndex = 0;
		for (index in this.currentTrick){
			var card = Cards[this.currentTrick[index]];
			if (trump){
				if ((card.color == this.currentTrump) && (card.trumpOrder > max)){
					max = card.trumpOrder;
					winnerIndex = index;
				}
			} else {
				if (card.color == this.currentTrump) {
					trump = true;
					max = card.trumpOrder;
					winnerIndex = index;
				} else if ((card.color == this.colorPlayed()) && (card.order > max)){
					max = card.order;
					winnerIndex = index;
				}
			}
		}
		res = (winnerIndex+this.firstTrickPlayer)%this.nbPlayers;
		return parseInt(winnerIndex);
	}

	// this.whoWins = function (){
	// 	//TODO
	// 	return null;// index!!!
	// }
}
function cardsOfColor (cards, color){
	var targetCards = [];
	cards.forEach(function(card){
		if (Cards[card].color == color){
			targetCards.push(card);
		}
	});
	return targetCards;
}

function manageTrumps(playedCards, availableCards, trumpColor){
	// console.log(playedCards + '-->' + availableCards + '-->' + trumpColor);
	var maxTrump = 0;
	playedCards.forEach(function(card){
		if (Cards[card].color == trumpColor){
			if (Cards[card].trumpOrder > maxTrump) maxTrump = Cards[card].trumpOrder;
		}
	});
	if(maxTrump == 0) return cardsOfColor(availableCards, trumpColor);

	var lowerTrumps = [];
	var upperTrumps = [];
	availableCards.forEach(function(card){
		if (Cards[card].color == trumpColor){
			if (Cards[card].trumpOrder > maxTrump){
				upperTrumps.push(card);
			} else {
				lowerTrumps.push(card);
			}
		}
	});
	assert(upperTrumps || lowerTrumps);
	return (upperTrumps.length>0?upperTrumps:lowerTrumps);
}