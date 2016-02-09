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
	var allUserReady = true;
	players.forEach(function(pName){
		allUserReady = allUserReady && users[pName].status == 'available';
	});
	if (!allUserReady) return -1;//TODO: notifier



	var inviteID = getNewAvailableGameId();

	invites[inviteID] = {player:[]};
	invites[inviteID].player[name] = true;
	users[name].game = {gameID:inviteID};
	updateStatus(name, 'hosting');
	players.forEach(function(pName){
		assert(users[pName]);
		invites[inviteID].player[pName] = false;
    	users[pName].game = {gameID:inviteID};//, accepted:false}; ---> ca veut dire quil es toccupé par une game quil ait accepte ou pas
		updateStatus(pName, 'pending_invite');
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
    				updateStatus(pName, 'in_game');
    			}
				for (pIndex in game.playersIndexes){
					var pName = game.playersIndexes[pIndex];
					// console.log['pName : ==> ' + pName];
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
	for(pName in invites[inviteID].player){
    	// assert(users[pName]);
    	// assert(users[pName].game);
    	// assert(users[pName].game.gameID == inviteID);
    	if (users[pName]) {
    		users[pName].game=null;
			updateStatus(pName, 'available');
		}
    }
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
	return new Game(gameID, players.sort());//notion d'equipe a mettre ici !!!
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
	this.currentAnnounce = {color:'', value:0, coinche:false, team:-1, playerName:''};
	this.belote = null;
	this.nextJetee = function(callback){//callback()
		this.distribute();
		this.currentTrump = '';//TODO
		this.currentAnnounce = {color:'', value:0,coinche:false, team:-1, playerName:''};
		// console.log({dealer: this.currentDealer, firstPlayer: this.firstTrickPlayer, currentPlayer: this.currentPlayer});

		for (pIndex in this.playersIndexes){
			var pName = this.playersIndexes[pIndex];
			io.to(users[pName].socket).emit('distribution', 
				{msg:'', cards: this.players[pName].cards, dealer: this.playersIndexes[this.currentDealer]});
		}

  		var winningAnnounce = {value: this.currentAnnounce.value, color:this.currentAnnounce.color , playerName: this.currentAnnounce.playerName};
		io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('announce', { winningAnnounce:winningAnnounce, msg:''});//TODO: pas bon choix en théorie car peut jouer quune partie a la foi... donc server devrait sen rappeler

		
		if (callback) callback();
	}

	this.distribute = function(callback){
		var cards = this.deck.distribute();
		var len = this.playersIndexes.length;//cards.length 
		for (var i = 0; i < len; i++) {
			this.players[this.playersIndexes[i]].cards = cards[i];
		};
	}

	this.collectCards = function(team){
		// this.currentTrick;
		this.deck.collectTrick(this.currentTrick, team);
	}

	this.gatherCards = function(){
		this.deck.fusionTeamTricks();
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
  			var announce = {name: this.playersIndexes[this.firstTrickPlayer], value:this.currentAnnounce.value, color:this.currentAnnounce.color, coinche: this.currentAnnounce.coinche}
  			if (announce.value == 0){//redistribution
  				this.currentDealer = (this.currentDealer+1)%this.nbPlayers;
  			} else {
	  			this.currentTrump = this.currentAnnounce.color;
  			}
	  		var winningAnnounce = {value: this.currentAnnounce.value, color:this.currentAnnounce.color , playerName: this.currentAnnounce.playerName};
	  		// console.log(winningAnnounce);
			io.emit('announced', { winningAnnounce: winningAnnounce, value:value, color:color, msg:'', name:name});
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
								//belote ?
								var bbelote = this.isThereABelote();
								console.log({belote: bbelote});
								io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('play', {message:'', cards: this.playableCards()});	
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
  		// console.log(winningAnnounce);
		io.emit('announced', { winningAnnounce: winningAnnounce, value:value, color:color, msg:'', name:name});

  		// PLAYE DID PASS BUT NOT EVERYONE TALKED
  		this.currentPlayer=(this.currentPlayer+1)%this.nbPlayers;
		// console.log('next annonce');
		io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('announce', { winningAnnounce:winningAnnounce, msg:'next announce'});//TODO: pas bon choix en théorie car peut jouer quune partie a la foi... donc server devrait sen rappeler

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

		io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('play', {message:'from this.coinche', cards: this.playableCards()});	
	}

	this.play = function(name, card, callback){//callback(endTrick)
  		assert(this.playersIndexes.indexOf(name)!=-1);
  		assert(this.playersIndexes.indexOf(name)===this.currentPlayer, " player is " + name + " but should be " + this.playersIndexes[this.currentPlayer]);

  		assert(AUTHORIZEDCARDS.indexOf(card)!=-1, 'AUTHORIZEDCARDS.indexOf(card): ' + AUTHORIZEDCARDS.indexOf(card) +' ' + card);
  		//remove played card from hand
  		var cardIndex = this.players[name].cards.indexOf(card);
  		assert(cardIndex!=-1, 'User played '+card+' but available cards should be '+ this.players[name].cards);

		io.emit('played', {name: name, card:card});//TODO: Gérer les erreurs
  		if (this.belote && name == this.playersIndexes[this.belote.player] && (Cards[card].value == 'Q' || Cards[card].value == 'K')){
  			console.log('belote!!!!!');
  			io.emit('belote', {message:'', name:name, rebelote: this.belote.rebelote})
  			if (!this.belote.rebelote) this.belote.rebelote = true;
  		}
  		this.players[name].cards.splice(cardIndex, 1);
		
		this.currentTrick.push(card);//TODO : order 
		// console.log('card ' + card + ' pushed in ' + this.currentTrick);
		// var endTrick = this.firstTrickPlayer==((this.currentPlayer+1)%this.nbPlayers);
		var endTrick = this.currentTrick.length == this.nbPlayers;
		if (endTrick) {
			this.endTrick();
		} else {
			this.currentPlayer=(this.currentPlayer+1)%this.nbPlayers;
			io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('play', {message:'from this.play', cards: this.playableCards()});	
		}
		if (callback) callback();
	}



	this.endTrick = function(){
		var endJetee = this.currentTrickIndex == 7;
		io.emit('end_trick', {message:'trick well ended', trick: this.currentTrick});
		//count points
		var winner = (this.trickWinner().index+this.firstTrickPlayer)%this.nbPlayers;
		// console.log({
		// 	winnerRank: this.trickWinner().index,
		// 	first: this.firstTrickPlayer,
		// 	winner : winner
		// })
		this.scores[this.players[this.playersIndexes[winner]].team].jetee += trickValue(this.currentTrick, this.currentTrump, endJetee);
		this.scores[0].trick = 0;
		this.scores[1].trick = 0;
		// console.log(this.scores);
		this.collectCards(this.players[this.playersIndexes[winner]].team);
		this.currentTrick = [];
		if (endJetee) {
			this.endJetee();
		} else {
			this.currentPlayer = winner;
			this.currentTrickIndex++;
			this.firstTrickPlayer = this.currentPlayer;
			io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('play', {message:'from this.endTrick', cards: this.playableCards()});	
		}

	}
	this.isThereABelote = function(){
		console.log('isThereABelote?');
		if (this.currentTrump == 'AT' || this.currentTrump == 'NT') return false;
		
		for (pName in this.players){
			console.log(pName);
			var cards = this.players[pName].cards;
			for (var j = 0; j < cards.length; j++) {//for each of its card
				var card = Cards[cards[j]];
				if (card.color == this.currentTrump){
					if (card.value == 'K'){
						console.log('...has the King!');
						for (var k = j+1; k < cards.length; k++){
							var secondCard=Cards[cards[k]];
							if (secondCard.value == 'Q' && secondCard.color == this.currentTrump){
								console.log('...and the Queen!');
								return this.belote = {player : this.playersIndexes.indexOf(pName), rebelote: false};
							}
						}
						console.log('...but not the Queen!');
						return false;	
					}
					if (card.value == 'Q'){
						console.log('...has the Queen!');
						for (var k = j+1; k < cards.length; k++){
							var secondCard=Cards[cards[k]];
							if (secondCard.value == 'K' && secondCard.color == this.currentTrump){
								console.log('...and the King!');
								return this.belote = {player : this.playersIndexes.indexOf(pName), rebelote: false};
							}
						}
						console.log('...but not the King!');
						return false;
					}
				}
			}
		}
	}

	this.endJetee = function(){
		/****COMPUTE SCORES****/
		if (this.scores[this.currentAnnounce.team].jetee == 162) this.scores[this.currentAnnounce.team].jetee = 250;
		if (this.belote) this.scores[this.players[this.playersIndexes[this.belote.player]].team].jetee +=20;
		/****COMPUTE WINNER****/
		var contractDone = this.scores[this.currentAnnounce.team].jetee >= this.currentAnnounce.value;
		var betterThanOtherTeam = this.scores[this.currentAnnounce.team].jetee > this.scores[(this.currentAnnounce.team+1)%2].jetee - (this.belote?(this.players[this.playersIndexes[this.belote.player]].team == (this.currentAnnounce.team+1)%2?20:0):0);
		var winner = (contractDone && betterThanOtherTeam)?this.currentAnnounce.team:(this.currentAnnounce.team+1)%2; 
		/****AFFECT SCORES****/
		this.scores[this.players[this.playersIndexes[winner]].team].match += parseInt(this.currentAnnounce.value);
		/****INFORM PLAYERS****/
		for (pIndex in this.playersIndexes){
			var pName = this.playersIndexes[pIndex];
			var scoresToSend = [];
			scoresToSend.push(this.scores[this.players[pName].team]);
			scoresToSend.push(this.scores[(this.players[pName].team+1)%2]);
			io.to(users[pName].socket).emit('end_jetee', {message:'jetee well ended', scores:scoresToSend});
		}	
		/****MANAGE END MATCH****/
		var endMatch = (this.scores[0].match >=2000 || this.scores[1].match >=2000);
		if (endMatch){
			this.endMatch();
		}
		/****ADVANCE IN GAME****/
		this.gatherCards();
		this.scores[0].jetee = 0;
		this.scores[1].jetee = 0;
		this.belote = null;
		this.currentDealer = (this.currentDealer + 1)%this.nbPlayers;
		this.firstTrickPlayer = (this.currentDealer + 1)%this.nbPlayers;
		this.currentPlayer = this.firstTrickPlayer;
		this.currentTrickIndex = 0;
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
			io.to(users[pName].socket).emit('end_match', {message:'match well ended', winner: this.players[pName].team == winner?0:1});
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
	this.reconnect = function(name){
		assert(this.players[name]);
		io.to(users[name].socket).emit('initialize_game', 
			{msg:'', players: this.playersIndexes, dealer: this.playersIndexes[this.currentDealer]});
		io.to(users[name].socket).emit('distribution', 
				{msg:'', cards: this.players[name].cards, dealer: this.playersIndexes[this.currentDealer]});
		//currentTrick
		var currentTrickCards = {};
		for (pIndex in this.currentTrick){
			// console.log({pindex: pIndex, card: this.currentTrick[pIndex]})
			var playerIndex = (parseInt(pIndex)+this.firstTrickPlayer)%this.nbPlayers;
			currentTrickCards[this.playersIndexes[playerIndex]] = this.currentTrick[pIndex];
		}

		io.to(users[name].socket).emit('display_current_trick', { cards:currentTrickCards, msg:'current trick is ...'});
		//scores
		var scoresToSend = [];
		scoresToSend.push(this.scores[this.players[name].team]);
		scoresToSend.push(this.scores[(this.players[name].team+1)%2]);
		scoresToSend[0].jetee = 0;
		scoresToSend[1].jetee = 0;
		io.to(users[name].socket).emit('scores', {message:'current scores', scores:scoresToSend});
		//last announce to know who is winning
			var winningAnnounce = {value: this.currentAnnounce.value, color:this.currentAnnounce.color , playerName: this.currentAnnounce.playerName};
	  		// console.log(winningAnnounce);
			io.emit('announced', { winningAnnounce: winningAnnounce, value:winningAnnounce.value, color:winningAnnounce.color, name:winningAnnounce.playerName, msg:''});
				//test scores
				//add send last announces as a 'this guy announced this' to display right the coinche button as well
		//are we currently announcing or playing??
		if (this.currentTrump) {
			io.to(users[name].socket).emit('chosen_trumps', 
							{msg:'', color: this.currentAnnounce.color, value: this.currentAnnounce.value, coinche: this.currentAnnounce.coinche});
		}
		if (this.playersIndexes[this.currentPlayer] == name ){
			if (this.currentTrump){
				//latout si annonce fini
				io.to(users[name].socket).emit('play', {message:'', cards: this.playableCards()});	
			} else {
  				var winningAnnounce = {value: this.currentAnnounce.value, color:this.currentAnnounce.color , playerName: this.currentAnnounce.playerName};
				io.to(users[name].socket).emit('announce', { winningAnnounce:winningAnnounce, msg:'next announce'});//TODO: pas bon choix en théorie car peut jouer quune partie a la foi... donc server devrait sen rappeler
			}
		}
		// console.log('reconnection of ' + name + ' to ' + this.gameID + ' successfull');
	}

	this.leaveGame = function(name){
		assert(this.players[name]);
		// plus complique qu'il ny parait!
		// soit qqun leave tt le monde part (pr linstant c ca)
		// soit on attend que on soit full (en mode room)
		for (pIndex in this.playersIndexes){
			var pName = this.playersIndexes[pIndex];
			users[pName].game = null;
			io.to(users[pName].socket).emit('leave_game', {message:'', name:name});
		}
		for (pIndex in this.playersIndexes){
			var pName = this.playersIndexes[pIndex];
			updateStatus(pName, 'available');
		}
		delete games[this.gameID];
	}

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

function updateStatus(name, status){
	users[name].status = status;
	// console.log('updateStatus');
	// console.log({name: name, status: status});
	for (index in users){
		io.to(users[index].socket).emit('user_status', {user:{name:name,status:status}});
	}
}