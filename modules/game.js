var MongoClient = 	('mongodb').MongoClient;
var url = 'mongodb://localhost:27017/test';
var CARD_COLLECTION = 'cards';

var assert = require('assert');
var Deck = require(__dirname +'/deck');
var Cards = require(__dirname +'/cards').template();
var games = {};
var invites = {};
var io;
var users = require('./connectedUsers');
var _res = {}//resulted element from require;
var TIMEUNIT = 1000;
var MAXPLAYER=2;
var AUTHORIZEDCARDS=['7H','8H','9H','10H','JH','QH','KH','AH','7D','8D','9D','10D','JD','QD','KD','AD','7S','8S','9S','10S','JS','QS','KS','AS','7C','8C','9C','10C','JC','QC','KC','AC'];

module.exports = function(launcherIo){
	// console.log(launcherIo);
	io = launcherIo;
	return _res;
}
// ==============================================================
// ================== INVITATIONS ===================================
// ==============================================================
_res.invite = invite;
function invite(name, players){
			//TODO: verifier que users.game = null (= quil peut etre invité)
	var inviteID = getNewAvailableGameId();

	invites[inviteID] = {player:[]};
	invites[inviteID].player[name] = true;
	users[name].game = {gameID:inviteID};
	players.forEach(function(pName){
		assert(users[pName]);
		invites[inviteID].player[pName] = false;
    	users[pName].game = {gameID:inviteID};//, accepted:false}; ---> ca veut dire quil es toccupé par une game quil ait accepte ou pas
						//TODO: decommenter underneath
						io.to(users[pName].socket).emit('game_invitation', {msg:'', name: name, gameID: inviteID});
	});
						    //////////////////A VIRER TEST
						 //    players.forEach(function(pName){
						 //    	accept(inviteID,pName);
						 //    });

							// if (readyToStart(inviteID)){
							// 	console.log('Game ready to start');
							// 	init(inviteID, function(game){
							// 		for (pIndex in game.playersIndexes){
							// 			var pName = game.playersIndexes[pIndex];
							// 			io.to(users[pName].socket).emit('initialize_game', 
							// 				{msg:'', players: game.playersIndexes, dealer: game.currentDealer});
							// 		}
							// 		game.nextJetee();
							// 	});
							// }
	invites[inviteID].timeoutFunction = setTimeout(function(){invitationCancel(inviteID,null); }, 10*TIMEUNIT);
	//TODO: set Timeout si client rep pas

	// console.log(invites);

}
_res.accept = accept;
function accept(inviteID, player){
	assert(inviteID);
	assert(invites[inviteID]);
	assert(invites[inviteID].player);
	assert(invites[inviteID].player[player]!=null);
	invites[inviteID].player[player] = true;
	if (readyToStart(inviteID)){
		clearTimeout(invites[inviteID].timeoutFunction);
				var game = init(inviteID);
				// console.log(users);
				// console.log(game.playersIndexes);
				for (pIndex in game.playersIndexes){
					var pName = game.playersIndexes[pIndex];
					console.log['pName : ==> ' + pName];
					io.to(users[pName].socket).emit('initialize_game', 
						{msg:'', players: game.playersIndexes, dealer: game.playersIndexes[game.currentDealer]});
				}
				game.nextJetee();
			}
}
_res.refuse = refuse;
function refuse(inviteID, player){
	assert(invites[inviteID]);
	assert(invites[inviteID].player[player]!=null);
	clearTimeout(invites[inviteID].timeoutFunction);
	invitationCancel(inviteID, player);
}

function invitationCancel(inviteID, player){
	invites[inviteID].player.forEach(function(pName){
    	assert(users[pName]);
    	assert(users[pName].game);
    	assert(users[pName].game.gameID == inviteID);
    	users[pName].game=null;
    })
	delete invites[inviteID];

	io.emit('game_invitation_cancelled', {message:'', gameID: inviteID, name:player});
}

_res.readyToStart = readyToStart;
function readyToStart(inviteID){
	assert(invites[inviteID]);
	var gameMustStart = true;
	for (index in invites[inviteID].player){
		gameMustStart = gameMustStart && invites[inviteID].player[index];
	}
	return gameMustStart;
}

// ==============================================================
// ================== GAME ADMIN===================================
// ==============================================================
_res.init = init;
function init(gameID){
	assert(invites[gameID]);
	assert(invites[gameID].player);
	assert(readyToStart(gameID));
	var players = [];
	for (player in invites[gameID].player){
		players.push(player);
	}
	return new Game(gameID, players);
}
_res.game = game;
function game(gameID){
	return games[gameID];
}
function getNewAvailableGameId(){
	do {
		var id = Math.floor((Math.random() * 1000));
	} while (invites[id] != null);
	return id;
}
function Game(id, players){
	if (games[id]) return null;
	games[id]=this;

	this.gameID=id;
	this.playersIndexes=players;//players[i]=pName;
	this.players = {};
	for(index in players){
		this.players[players[index]]={team: index%2};
	}
	this.nbPlayers=players.length;

	rand=Math.floor((Math.random() * this.nbPlayers));
	
	this.deck=Deck.newDeck();

	this.namespace=null;
	
	this.currentTrickIndex = 0;
	this.currentTrick=[];
	
	this.currentDealer=rand;
	this.currentPlayer=(rand+1)%this.nbPlayers;
	this.firstTrickPlayer=(rand+1)%this.nbPlayers;
	
	this.scores = [{match:0, game:0, jetee:0},{match:0, game:0, jetee:0}];
	this.currentTrump = '';
	this.currentAnnounce = {color:'', value:0, coinche:false, team:-1};

	this.nextJetee = function(callback){//callback()
		this.distribute();
		this.currentTrump = '';//TODO
		this.currentAnnounce = {color:'', value:0,coinche:false, team:-1};
		console.log({dealer: this.currentDealer, firstPlayer: this.firstTrickPlayer, currentPlayer: this.currentPlayer});

		for (pIndex in this.playersIndexes){
			var pName = this.playersIndexes[pIndex];
			io.to(users[pName].socket).emit('distribution', 
				{msg:'', cards: this.players[pName].cards, dealer: this.playersIndexes[this.currentDealer]});
		}

		io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('announce', {gameID:this.gameID, lastAnnounce:{}, msg:''});//TODO: pas bon choix en théorie car peut jouer quune partie a la foi... donc server devrait sen rappeler
		
		if (callback) callback();
	}

	this.distribute = function(callback){
		var cards = this.deck.distribute();
		var len = this.playersIndexes.length;//cards.length 
		for (var i = 0; i < len; i++) {
			this.players[this.playersIndexes[i]].cards = cards[i];
		};
	}
// ==============================================================
// ================== GAME RULES ===================================
// ==============================================================
//When a player plays a card
	this.announce = function(name, value, color, callback){
  		assert(this.playersIndexes.indexOf(name)!=-1);
  		assert(this.playersIndexes.indexOf(name)===this.currentPlayer);

  		assert((parseInt(value) > parseInt(this.currentAnnounce.value)) || value == 0, 'new announce not greater or pass ' + value + ' !> ' + this.currentAnnounce.value);

  		// END OF ANNOUNCE 
  		if (value == 0 && ((this.currentPlayer+1)%this.nbPlayers)==this.firstTrickPlayer ){
  			var announce = {name: this.playersIndexes[this.firstTrickPlayer], value:this.currentAnnounce.value, color:this.currentAnnounce.color}
  			if (announce.value == 0){//redistribution
  				this.currentDealer = (this.currentDealer+1)%this.nbPlayers;
  			} else {
	  			this.currentTrump = this.currentAnnounce.color;
  			}
	  		var winningAnnounce = {value: this.currentAnnounce.value, color:this.currentAnnounce.color , playerName: this.currentAnnounce.playerName};
	  		console.log(winningAnnounce);
			io.emit('announced', {gameID:this.gameID, winningAnnounce: winningAnnounce, value:value, color:color, msg:'', name:name});
  			this.firstTrickPlayer = (this.currentDealer+1)%this.nbPlayers;
  			this.currentPlayer = this.firstTrickPlayer;
			
							for (pIndex in this.playersIndexes){
								var pName = this.playersIndexes[pIndex];
								io.to(users[pName].socket).emit('chosen_trumps', 
									{msg:'', color: announce.color, value: announce.value});
							}
							if (announce.value == 0){//TODO: next game
								// console.log('all passed');
								this.nextJetee();
							} else {
								// console.log('finalAnnounce lets play');
								io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('play', {message:'',gameID:this.gameID, cards: this.playableCards()});	
							}
			// console.log(this);
			return callback?callback():1;
  		}

  		// NEW BET
  		if (value != 0){
  			this.firstTrickPlayer=this.currentPlayer;
  			this.currentAnnounce.value = value;
  			this.currentAnnounce.color = color;
  			this.currentAnnounce.team = this.players[name].team;
  			this.currentAnnounce.playerName = name;
  		}

  		var winningAnnounce = {value: this.currentAnnounce.value, color:this.currentAnnounce.color , playerName: this.currentAnnounce.playerName};
  		console.log(winningAnnounce);
		io.emit('announced', {gameID:this.gameID, winningAnnounce: winningAnnounce, value:value, color:color, msg:'', name:name});
			
  		// PLAYE DID PASS BUT NOT EVERYONE TALKED
  		this.currentPlayer=(this.currentPlayer+1)%this.nbPlayers;
		// console.log('next annonce');
		io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('announce', {gameID:this.gameID, lastAnnounce:(this.currentAnnounce.value), msg:'next announce'});//TODO: pas bon choix en théorie car peut jouer quune partie a la foi... donc server devrait sen rappeler
		
		if (callback) callback();

	}

	this.coinche = function (name){
		io.emit('coinche', {name:name});
		this.currentTrump = this.currentAnnounce.color;
		this.currentAnnounce.coinche = true;

		this.firstTrickPlayer = (this.currentDealer+1)%this.nbPlayers;
		this.currentPlayer = this.firstTrickPlayer;
		
		for (pIndex in this.playersIndexes){
			var pName = this.playersIndexes[pIndex];
			io.to(users[pName].socket).emit('chosen_trumps', 
				{msg:'', color: this.currentAnnounce.color, value: this.currentAnnounce.value, coinche: this.currentAnnounce.coinche});
		}

		io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('play', {message:'from this.coinche',gameID:this.gameID, cards: this.playableCards()});	
	}

	this.play = function(name, card, callback){//callback(endTrick)
  		assert(this.playersIndexes.indexOf(name)!=-1);
  		assert(this.playersIndexes.indexOf(name)===this.currentPlayer, " player is " + name + " but should be " + this.playersIndexes[this.currentPlayer]);

  		assert(AUTHORIZEDCARDS.indexOf(card)!=-1, 'AUTHORIZEDCARDS.indexOf(card): ' + AUTHORIZEDCARDS.indexOf(card) +' ' + card);
  		//remove played card from hand
		io.emit('played', {name: name, card:card});//TODO: Gérer les erreurs
  		var cardIndex = this.players[name].cards.indexOf(card);
  		assert(cardIndex!=-1, 'User played '+card+' but available cards should be '+ this.players[name].cards);
  		this.players[name].cards.splice(cardIndex, 1);
		
		this.currentTrick.push(card);//TODO : order 
		// console.log('card ' + card + ' pushed in ' + this.currentTrick);
		// var endTrick = this.firstTrickPlayer==((this.currentPlayer+1)%this.nbPlayers);
		var endTrick = this.currentTrick.length == this.nbPlayers;
		if (endTrick) {
			this.endTrick();
		} else {
			this.currentPlayer=(this.currentPlayer+1)%this.nbPlayers;
			io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('play', {message:'from this.play',gameID:this.gameID, cards: this.playableCards()});	
		}
		if (callback) callback();
	}


	this.endTrick = function(){
		var endJetee = this.currentTrickIndex == 7;
		io.emit('end_trick', {message:'trick well ended', trick: this.currentTrick});
		//count points
		var winner = (this.trickWinner().index+this.firstTrickPlayer)%this.nbPlayers;
		console.log({
			winnerRank: this.trickWinner().index,
			first: this.firstTrickPlayer,
			winner : winner
		})
		this.scores[this.players[this.playersIndexes[winner]].team].jetee += trickValue(this.currentTrick, this.currentTrump, endJetee);
		this.scores[0].trick = 0;
		this.scores[1].trick = 0;
		// console.log(this.scores);
		this.currentTrick = [];
		if (endJetee) {
			this.endJetee();
		} else {
			this.currentPlayer = winner;
			this.currentTrickIndex++;
			this.firstTrickPlayer = this.currentPlayer;
			io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('play', {message:'from this.endTrick',gameID:this.gameID, cards: this.playableCards()});	
		}

	}

	this.endJetee = function(){
		//compter les points
		// console.log(this);
		// console.log(this.currentAnnounce);
		if (this.scores[this.currentAnnounce.team].jetee == 162) this.scores[this.currentAnnounce.team].jetee = 250;
		var BELOTTE = false; //TODO !!
		if (BELOTTE) this.scores[this.currentAnnounce.team].jetee +=20;
		//TODO: AJOUTER BELOTTE
		var winner = this.scores[this.currentAnnounce.team].jetee >= this.currentAnnounce.value?this.currentAnnounce.team:(this.currentAnnounce.team+1)%2; 
		this.scores[this.players[this.playersIndexes[winner]].team].match += parseInt(this.currentAnnounce.value);
		var endMatch = (this.scores[0].match >=2000 || this.scores[1].match >=2000);
		// console.log(this.scores);
		for (pIndex in this.playersIndexes){
			var pName = this.playersIndexes[pIndex];
			var scoresToSend = [];
			scoresToSend.push(this.scores[this.players[pName].team]);
			scoresToSend.push(this.scores[(this.players[pName].team+1)%2]);
			io.to(users[pName].socket).emit('end_jetee', {message:'jetee well ended', scores:scoresToSend});
		}	
		this.scores[0].jetee = 0;
		this.scores[1].jetee = 0;
		// this.scores = [{match:0, game:0, jetee:0},{match:0, game:0, jetee:0}];
		if (endMatch){
			this.endMatch();
		} else {

		}

		this.currentDealer = (this.currentDealer + 1)%this.nbPlayers;
		this.firstTrickPlayer = (this.currentDealer + 1)%this.nbPlayers;
		this.currentPlayer = this.firstTrickPlayer;
		this.currentTrickIndex = 0;
		// this.currentTrick = [];
		console.log('endJetee');
		this.nextJetee();
		

	}
	this.endMatch = function(){
		var winner = this.scores[0].match >=2000 ? 0:1;
		this.scores[winner].match ++;
		this.scores[0].match = 0;
		this.scores[1].match = 0;
		for (pIndex in this.playersIndexes){
			var pName = this.playersIndexes[pIndex];
			io.to(users[pName].socket).emit('end_match', {message:'match well ended', scores:this.scores});
		}	
	}

	this.playableCards = function(){
		// console.log('PLAYABLE CARDS...');
		var thisPlayer = this.players[this.playersIndexes[this.currentPlayer]];
		//IF IM FIRST TO PLAY
		// console.log(this.currentTrick);
		if (this.firstToPlay()) return thisPlayer.cards;
		// console.log('NOT FIRST...');

		var colorPlayedCards = cardsOfColor(thisPlayer.cards,this.colorPlayed());
		//IF I HAVE THE COLOR
		if (colorPlayedCards.length > 0){
			// console.log('I HAVE THE COLOR...');
			if ((this.colorPlayed()==this.currentTrump) || this.currentTrump == 'AT'){
				// console.log('WHICH IS TRUMP..');
				return manageTrumps(this.currentTrick, thisPlayer.cards, this.currentTrump,this.colorPlayed());
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
			return manageTrumps(this.currentTrick, thisPlayer.cards, this.currentTrump,this.colorPlayed());
		}
		// console.log('NO TRUMPS...');
		return thisPlayer.cards;
	}

	this.playableCards2 = function(){//sale
		var thisPlayer = this.players[this.playersIndexes[this.currentPlayer]];
		if (this.firstToPlay()) return thisPlayer.cards;

		var colorPlayedCards = cardsOfColor(thisPlayer.cards,this.colorPlayed());
		if (colorPlayedCards.length > 0){
			if ((this.colorPlayed()==this.currentTrump) || this.currentTrump == 'AT'){
				return manageTrumps(this.currentTrick, thisPlayer.cards, this.currentTrump);
			}
			return colorPlayedCards;
		}
		if (this.partnerIsWinning()) return thisPlayer.cards;
		var trumpPlayedCards = cardsOfColor(thisPlayer.cards,this.currentTrump);
		if(trumpPlayedCards.length>0){
			return manageTrumps(this.currentTrick, thisPlayer.cards, this.currentTrump);
		}
		return thisPlayer.cards;
	}
	
	this.colorPlayed = function(){
		// assert(this.currentTrick[0]);
		if (!this.currentTrick[0])  return 'FIRST PLAYER';
		return Cards[this.currentTrick[0]].color;
	}

	this.firstToPlay = function(){
  		// return this.playersIndexes.indexOf(name)==this.currentPlayer;
  		return this.currentTrick.length == 0;
	}

	this.partnerIsWinning = function(){ //ROBINROBINROBIN
		var len = this.currentTrick.length;
		if (len >=2){
			return this.trickWinner().index == len - 2;//TODO
		}
		return false;
	}

	this.trickWinner = function(){
		var defaultOrder = (this.currentTrump == 'AT'?'trumpOrder':'order');//if AT or NT, always defaultOrder

		var cut = false;
		var max = 0;
		var winnerIndex = 0;
		var winningCard = {};
		for (index in this.currentTrick){
			var card = Cards[this.currentTrick[index]];

			//j'ai la couleur ?
			if (cut){
				if ((card.color == this.currentTrump) && (card.trumpOrder > max)){
					max = card.trumpOrder;
					winnerIndex = index;
					winningCard = card;
				}
			} else {
				if (card.color == this.currentTrump) {
					cut = true;
					max = card.trumpOrder;
					winnerIndex = index;
					winningCard = card;
				} else if ((card.color == this.colorPlayed()) && (card[defaultOrder] > max)){
					max = card[defaultOrder];
					winnerIndex = index;
					winningCard = card;
				}
			}


		}
		res = (winnerIndex+this.firstTrickPlayer)%this.nbPlayers;
		return {card: winningCard, index: parseInt(winnerIndex)};
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

function manageTrumps(playedCards, availableCards, trumpColor, playedColor){
	// console.log(playedCards + '-->' + availableCards + '-->' + trumpColor);
	var maxTrump = 0;
	playedCards.forEach(function(card){
		if (Cards[card].color == trumpColor || (trumpColor == 'AT' && Cards[card].color == playedColor)) {
			if (Cards[card].trumpOrder > maxTrump) maxTrump = Cards[card].trumpOrder;
		}
	});
	if(maxTrump == 0) return cardsOfColor(availableCards, trumpColor);

	var lowerTrumps = [];
	var upperTrumps = [];
	availableCards.forEach(function(card){
		if (Cards[card].color == trumpColor|| (trumpColor == 'AT' && Cards[card].color == playedColor)) {
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

function trickValue(trick, trump, lastTrick){
	var res = 0;
	// console.log({
	// 	trick: trick,
	// 	trump: trump,
	// 	lastTrick: lastTrick
	// });
	trick.forEach(function(card){
		if (trump == 'AT'){
			res += Cards[card].allTrumpsPoints;
		} else if (trump == 'NT'){
			res += Cards[card].noTrumpsPoints;
		} else if (trump == Cards[card].color){
			res += Cards[card].trumpPoints;
		} else {
			res += Cards[card].points;
		}
	});
	if (lastTrick) res += 10;
	return res;
}