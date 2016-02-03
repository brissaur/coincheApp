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

var MAXPLAYER=2;
var AUTHORIZEDCARDS=['7H','8H','9H','10H','JH','QH','KH','AH','7D','8D','9D','10D','JD','QD','KD','AD','7S','8S','9S','10S','JS','QS','KS','AS','7C','8C','9C','10C','JC','QC','KC','AC'];

module.exports = function(launcherIo){
	// console.log(launcherIo);
	io = launcherIo;
	return _res;
}
// _res.test = function(){
// 	console.log('test');
// 	console.log(users);
// }

// ==============================================================
// ================== INVITATIONS ===================================
// ==============================================================
_res.invite = invite;
function invite(name, players){
	var inviteID = getNewAvailableGameId();//TODO: pb unicité
	// console.log('invite ' + inviteID + ' for '+ players);
	//TODO: set Timeout!!!!!
	// assert(!invites[inviteID]);
	invites[inviteID] = [];
	invites[inviteID][name] = true;
	users[name].game = {gameID:inviteID};
	players.forEach(function(pName){
		assert(users[pName]);
		invites[inviteID][pName] = false;
    	users[pName].game = {gameID:inviteID};//, accepted:false}; ---> ca veut dire quil es toccupé par une game quil ait accepte ou pas
						//TODO: decommenter underneath
						// io.emit('game_invitation', {name: name, message: '', gameID: gameID});//TODO EVOL roadcast+print local
						// socket.broadcast.emit('game_invitation', {name: name, message: '', gameID: gameID});//TODO EVOL roadcast+print local
						// io.to(users[pName].socket).emit('game_invitation', {msg:'', name: name, gameID: inviteID});
	});
						    //////////////////A VIRER TEST
						    players.forEach(function(pName){
						    	accept(inviteID,pName);
						    });

							if (readyToStart(inviteID)){
								console.log('Game ready to start');
								init(inviteID, function(game){
									for (pIndex in game.playersIndexes){
										var pName = game.playersIndexes[pIndex];
										io.to(users[pName].socket).emit('initialize_game', 
											{msg:'', players: game.playersIndexes, dealer: game.currentDealer});
									}
									game.nextJetee();
								});
							}
	//TODO: set Timeout si client rep pas

	// console.log(invites);

}
_res.accept = accept;
function accept(inviteID, player){
	// console.log('invite ' + inviteID + ' ACCEPTED by' +player);
	// console.log(player +' accepts '+ inviteID);
	// console.log(invites);
	assert(inviteID);
	assert(invites[inviteID]);
		// console.log(invites[inviteID]);
	assert(invites[inviteID][player]!=null);
	invites[inviteID][player] = true;
	if (readyToStart(inviteID)){
				// console.log('Game ready to start');
				var game = init(inviteID);
				for (pIndex in game.playersIndexes){
					var pName = game.playersIndexes[pIndex];
					io.to(users[pName].socket).emit('initialize_game', 
						{msg:'', players: game.playersIndexes, dealer: game.currentDealer});
				}
				game.nextJetee();
			}
}
_res.refuse = refuse;
function refuse(inviteID, player){
	assert(invites[inviteID]);
	assert(invites[inviteID][player]!=null);

    invites[inviteID].forEach(function(pName){
    	assert(users[pName]);
    	assert(users[pName].game);
    	assert(users[pName].game.gameID == inviteID);
    	users[pName].game=null;
    })
	delete invites[inviteID];

    io.emit('game_invitation_cancelled', {message:'', gameID: inviteID, name:player});


	// est ce quon renvoit les players?
}
_res.readyToStart = readyToStart;
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
_res.init = init;
function init(gameID){
	assert(invites[gameID]);
	assert(readyToStart(gameID));
	var players = [];
	for (player in invites[gameID]){
		players.push(player);
	}
	return new Game(gameID, players);
}
// _res.init = init;
// _res.newGame = newGame;
// function newGame(players){
// 	var g = new Game(players);
// 	games[g.id] = g;
// 	return g;
// }
_res.game = game;
function game(gameID){
	return games[gameID];
}
// _res.getNewAvailableGameId = getNewAvailableGameId;
function getNewAvailableGameId(){
	return Math.floor((Math.random() * 1000));
}
// _res.getNewAvailableGameId = getNewAvailableGameId;
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
		this.players[players[index]]={team: index%2};
	}
	//TODO: add team numbers 0 / 1
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
				{msg:'', cards: this.players[pName].cards});
		}

		io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('announce', {gameID:this.gameID, lastAnnounce:0, msg:''});//TODO: pas bon choix en théorie car peut jouer quune partie a la foi... donc server devrait sen rappeler
		
		if (callback) callback();
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
		// console.log({
		// 	dealer: {name: this.playersIndexes[this.currentDealer], id:this.currentDealer},
		// 	firstTrickPlayer: {name: this.playersIndexes[this.firstTrickPlayer] , id:this.firstTrickPlayer},
		// 	currentPlayer: {name: this.playersIndexes[this.currentPlayer] , id:this.currentPlayer}
		// });
  		assert(this.playersIndexes.indexOf(name)!=-1);
  		assert(this.playersIndexes.indexOf(name)===this.currentPlayer);

  		assert((parseInt(value) > parseInt(this.currentAnnounce.value)) || value == 0, 'new announce not greater or pass ' + value + ' !> ' + this.currentAnnounce.value);

		io.emit('announced', {gameID:this.gameID, value:value, color:color, msg:'', name:name});

  		// END OF ANNOUNCE 
  		if (value == 0 && ((this.currentPlayer+1)%this.nbPlayers)==this.firstTrickPlayer ){
  			debugger;
  			var announce = {name: this.playersIndexes[this.firstTrickPlayer], value:this.currentAnnounce.value, color:this.currentAnnounce.color}
  			if (announce.value == 0){//redistribution
  				this.currentDealer = (this.currentDealer+1)%this.nbPlayers;
  			} else {
	  			this.currentTrump = this.currentAnnounce.color;
  			}
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
  		}

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
		var winner = (this.trickWinner()+this.firstTrickPlayer)%this.nbPlayers;
		console.log({
			winnerRank: this.trickWinner(),
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
		//TODO: AJOUTER BELOTTE
		var winner = this.scores[this.currentAnnounce.team].jetee >= this.currentAnnounce.value?this.currentAnnounce.team:(this.currentAnnounce.team+1)%2; 
		this.scores[this.players[this.playersIndexes[winner]].team].match = this.currentAnnounce.value;
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
		console.log(this.currentTrick);
		if (this.firstToPlay()) return thisPlayer.cards;
		// console.log('NOT FIRST...');

		var colorPlayedCards = cardsOfColor(thisPlayer.cards,this.colorPlayed());
		//IF I HAVE THE COLOR
		if (colorPlayedCards.length > 0){
			// console.log('I HAVE THE COLOR...');
			if ((this.colorPlayed()==this.currentTrump) || this.currentTrump == 'AT'){
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
  		// return this.playersIndexes.indexOf(name)==this.currentPlayer;
  		return this.currentTrick.length == 0;
	}

	this.partnerIsWinning = function(){ //ROBINROBINROBIN
		// console.log({
		// 	type: 'partnerIsWinning',
		// 	currentPlayer: this.currentPlayer,
		// 	trick: this.currentTrick,
		// 	trickWinner: this.trickWinner()
		// })
		var len = this.currentTrick.length;
		if (len >=2){
			return this.trickWinner() == len - 2;//TODO
		}
		return false;
	}

	this.trickWinner = function(){
		var defaultOrder = (this.currentTrump == 'AT'?'trumpOrder':'order');//if AT or NT, always defaultOrder

		var cut = false;
		var max = 0;
		var winnerIndex = 0;
		for (index in this.currentTrick){
			var card = Cards[this.currentTrick[index]];

			//j'ai la couleur ?
			if (cut){
				if ((card.color == this.currentTrump) && (card.trumpOrder > max)){
					max = card.trumpOrder;
					winnerIndex = index;
				}
			} else {
				if (card.color == this.currentTrump) {
					cut = true;
					max = card.trumpOrder;
					winnerIndex = index;
				} else if ((card.color == this.colorPlayed()) && (card[defaultOrder] > max)){
					max = card[defaultOrder];
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