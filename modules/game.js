// ==============================================================
// ================== REQUIRES ==================================
// ==============================================================
var assert = require('assert');
var io;

var Deck = require(__dirname +'/deck');
var Cards = require(__dirname +'/cards').template();
var users = require('./connectedUsers');

// ==============================================================
// ================== GLOBAL VARS ==================================
// ==============================================================var MongoClient = 	('mongodb').MongoClient;
var _res = {}//resulted element from require;
// var url = 'mongodb://localhost:27017/test';
var invites = {};
var rooms = {};
var games = {};

var CARD_COLLECTION = 'cards';
var TIMEUNIT = 1000;
var MAXPLAYER=2;
var AUTHORIZEDCARDS=['7H','8H','9H','10H','JH','QH','KH','AH','7D','8D','9D','10D','JD','QD','KD','AD','7S','8S','9S','10S','JS','QS','KS','AS','7C','8C','9C','10C','JC','QC','KC','AC'];

module.exports = function(launcherIo){
	io = launcherIo;
	return _res;
}
// ==============================================================
// ================== INVITATIONS ===================================
// ==============================================================
_res.invite = invite;
function invite(name, players){
	/*** CHECK INVITES USER ARE AVAILABLE***/
	var allUserReady = true;
	players.forEach(function(pName){
		allUserReady = allUserReady && users[pName].status == 'available';
	});
	if (!allUserReady) return -1;//TODO: notify user

	/*** CREATE NEW INVITATION ***/
	// var inviteID = getNewAvailableGameId();
	// invites[inviteID] = {player:[]};

	/*** ADD INVITER ***/
	// invites[inviteID].player[name] = true;
	// users[name].game = {gameID:inviteID};
	// updateStatus(name, 'hosting');
	var inviteID = users[name].game.gameID;
	/*** ADD INVITER ***/
	players.forEach(function(pName){
		assert(users[pName]);
		// invites[inviteID].player[pName] = false;
    	users[pName].game = {gameID:inviteID};
		updateStatus(pName, 'pending_invite');
		io.to(users[pName].socket).emit('game_invitation', {msg:'', name: name, gameID: inviteID});
		/*** ADD TIMEOUT ***/
		users[pName].timeoutFunction = setTimeout(function(){gameInvitationCancel(pName); }, 10*TIMEUNIT);
	});
	
}

	function gameInvitationCancel(name){
		//notify host
		io.to(users[rooms[users[name].game.gameID].host].socket).emit('game_invitation_cancelled', {message:'', name:name});
		//notify name
		io.to(users[name].socket).emit('invitation_timeout', {message:'', name:name});

		//delete info
		delete users[name].timeoutFunction;
		users[name].game = null;
		updateStatus(name, 'available');
	}

_res.newRoom = newRoom;
function newRoom(name){
	/*** CREATE NEW INVITATION ***/
	var roomID = getNewAvailableGameId();
	rooms[roomID] = {player:[]};
	// rooms[roomID].order = {};
	rooms[roomID].host=name;
	rooms[roomID].nbPlayers = 1;
	rooms[roomID].places = {};
	rooms[roomID].availablePlaces = [3,2,1];
	/*** ADD HOST ***/
	// rooms[roomID].player[name] = true;
	// rooms[roomID].order[0]=name;
	rooms[roomID].places[name] = 0;
	users[name].game = {gameID:roomID};
	updateStatus(name, 'hosting');
	
	// /*** ADD INVITER ***/
	// players.forEach(function(pName){
	// 	assert(users[pName]);
	// 	invites[inviteID].player[pName] = false;
 //    	users[pName].game = {gameID:inviteID};
	// 	updateStatus(pName, 'pending_invite');
	// 	io.to(users[pName].socket).emit('game_invitation', {msg:'', name: name, gameID: inviteID});
	// });
	
	/*** ADD TIMEOUT ***/
	// invites[inviteID].timeoutFunction = setTimeout(function(){invitationCancel(inviteID,null); }, 10*TIMEUNIT);
}
_res.leaveRoom = leaveRoom;
function leaveRoom(name){
	var targetRoom = rooms[users[name].game.gameID];
	if (targetRoom.host == name){
		for (pName in targetRoom.places){
			if (pName != name) io.to(users[pName].socket).emit('room_cancel',{name:name});//4: to check
		}
		for (pName in targetRoom.places){
			users[pName].game = null;
			updateStatus(pName, 'available');
		}
		delete targetRoom;
		return;
	}
	if (targetRoom.nbPlayers == 4) io.to(users[targetRoom.host].socket).emit('game_not_ready_to_start',{});
	targetRoom.nbPlayers--;
	for (pName in targetRoom.places){
		io.to(users[pName].socket).emit('left_room',{name:name});//4: to check
	}
	targetRoom.availablePlaces.push(targetRoom.places[name]);
	delete targetRoom.places[name];

	users[name].game = null;
	updateStatus(name, 'available');
}



_res.accept = accept;
function accept(player){
	clearTimeout(users[player].timeoutFunction);

	var targetRoom = rooms[users[player].game.gameID];
	if (targetRoom.nbPlayers == 4) {
		//notify
		return;
	}
	targetRoom.nbPlayers++;
	var newPlayerIndex = targetRoom.availablePlaces.pop();
	targetRoom.places[player] = newPlayerIndex;

	for(pName in targetRoom.places){
		var pIndex = targetRoom.places[pName];
		if (pName != player){
			io.to(users[pName].socket).emit('joined_room',
				{name:player, place:(newPlayerIndex-pIndex+4)%4});//4: to check
		
			io.to(users[player].socket).emit('joined_room',
				{name:pName, place:(pIndex-newPlayerIndex+4)%4});//4: to check
		}
	}

	if (targetRoom.nbPlayers == 4) io.to(users[targetRoom.host].socket).emit('game_ready_to_start',{});
}

_res.refuse = refuse;
function refuse(player){
	clearTimeout(users[player].timeoutFunction);
	/*** CANCEL GAME ***/
	gameInvitationCancel(player);
}

_res.swapPlace = swapPlace;
function swapPlace(p1, p2){
	var thisRoom = rooms[users[p1].game.gameID];
	var p1index = thisRoom.places[p1];
	var p2index = thisRoom.places[p2];
	thisRoom.places[p1] = p2index;
	thisRoom.places[p2] = p1index;

	
	//notify
	io.to(users[p1].socket).emit('you_swap',{name:p2});
	io.to(users[p2].socket).emit('you_swap',{name:p1});

	for (pName in thisRoom.places){
		if (pName != p1 && pName != p2){
			io.to(users[pName].socket).emit('they_swap',{p1:p1, p2:p2});
		}
	}
	console.log(thisRoom.places);
}

_res.startGame = startGame;
function startGame(name){
	var gameID = users[name].game.gameID;
	assert(rooms[gameID].host == name);
	assert(rooms[gameID].nbPlayers == 4);
	var players = [];
	for (player in rooms[gameID].places){
		players[rooms[gameID].places[player]] = player;
	}
	console.log(players);
	games[gameID] = new Game(gameID, players);
	thisGame = games[gameID];

	// thisGame.
	thisGame.distribute();
	thisGame.playersIndexes.forEach(function(pName){
		io.to(users[pName].socket).emit('initialize_game', 
			{msg:'', players: thisGame.playersIndexes, dealer: thisGame.playersIndexes[thisGame.currentDealer]});
		io.to(users[pName].socket).emit('distribution', 
			{msg:'', cards: thisGame.players[pName].cards, dealer: thisGame.playersIndexes[thisGame.currentDealer]});
		updateStatus(pName, 'in_game');
	});
	io.to(users[thisGame.playersIndexes[thisGame.currentPlayer]].socket).emit('announce', { winningAnnounce:{value:0,color:'',playerName:''}, msg:''});

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
	return new Game(gameID, players.sort());
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
// ==============================================================
// ================== RELATED TO DEALING ========================
// ==============================================================

	this.distribute = function(callback){
		var cards = this.deck.distribute();
		var len = this.playersIndexes.length;
		for (var i = 0; i < len; i++) {
			this.players[this.playersIndexes[i]].cards = cards[i];
		};
	}

	this.collectCards = function(team){
		this.deck.collectTrick(this.currentTrick, team);
	}

	this.gatherCards = function(){
		this.deck.fusionTeamTricks();
	}

// ==============================================================
// ================== PLAYER INTERFACE ==========================
// ==============================================================

	/*** WHEN A PLAYER ANNOUNCES ***/
	this.announce = function(name, value, color, callback){
		//<<<<<<<<<<<<<<< ASSERTS >>>>>>>>>>>>>>>>
  		assert(this.playersIndexes.indexOf(name)!=-1);
  		assert(this.playersIndexes.indexOf(name)===this.currentPlayer);
  		assert((parseInt(value) > parseInt(this.currentAnnounce.value)) || value == 0, 'new announce not greater or pass ' + value + ' !> ' + this.currentAnnounce.value);

		//<<<<<<<<<<<<<<< IF AN ANNOUNCE HAS BEEN ELECTED >>>>>>>>>>>>>>>>
  		if (value == 0 && ((this.currentPlayer+1)%this.nbPlayers)==this.firstTrickPlayer ){
  			var announce = {name: this.playersIndexes[this.firstTrickPlayer], value:this.currentAnnounce.value, color:this.currentAnnounce.color, coinche: this.currentAnnounce.coinche}
  			
  			if (announce.value == 0){
  				this.currentDealer = (this.currentDealer+1)%this.nbPlayers;
  			} else {
	  			this.currentTrump = this.currentAnnounce.color;
  			}

	  		var winningAnnounce = {value: this.currentAnnounce.value, color:this.currentAnnounce.color , playerName: this.currentAnnounce.playerName};
			io.emit('announced', { winningAnnounce: winningAnnounce, value:value, color:color, msg:'', name:name});
  			this.firstTrickPlayer = (this.currentDealer+1)%this.nbPlayers;
  			this.currentPlayer = this.firstTrickPlayer;
			//NOTIFY PLAYERS OF THE CHOSEN TRUMP
			for (pIndex in this.playersIndexes){
				var pName = this.playersIndexes[pIndex];
				io.to(users[pName].socket).emit('chosen_trumps', 
					{msg:'', color: announce.color, value: announce.value});
			}
  			//NO ONE ANNOUNCED -> REDISTRIBUTION
			if (announce.value == 0){
				this.nextJetee();
  			//OR PLAY 
			} else {
				//COMPUTE IF THERE IS A BELOTE 
				this.isThereABelote();
				//NOTIFY FIRST PLAYER HIS TURN TO PLAY 
				io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('play', {message:'', cards: this.playableCards()});	
			}
			return callback?callback():1;
  		}

		//<<<<<<<<<<<<<<< IF THIS ANNOUNCE GREATER THAN LAST ANNOUNCE >>>>>>>>>>>>>>>>
  		if (value != 0){
  			//REMEMBER ANNOUNCE DATA
  			this.firstTrickPlayer=this.currentPlayer;
  			this.currentAnnounce.value = value;
  			this.currentAnnounce.color = color;
  			this.currentAnnounce.team = this.players[name].team;
  			this.currentAnnounce.playerName = name;
  		}
  		
		//<<<<<<<<<<<<<<< NOTIFY PLAYERS OF THE NEW ANNOUNCE >>>>>>>>>>>>>>>>
  		var winningAnnounce = {value: this.currentAnnounce.value, color:this.currentAnnounce.color , playerName: this.currentAnnounce.playerName};
		io.emit('announced', { winningAnnounce: winningAnnounce, value:value, color:color, msg:'', name:name});

  		this.currentPlayer=(this.currentPlayer+1)%this.nbPlayers;
		//<<<<<<<<<<<<<<< NOTIFY NEXT PLAYER HIS TURN TO ANNOUNCE >>>>>>>>>>>>>>>>
		io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('announce', { winningAnnounce:winningAnnounce, msg:'next announce'});//TODO: pas bon choix en théorie car peut jouer quune partie a la foi... donc server devrait sen rappeler

		if (callback) callback();

	}
	
	/*** WHEN A PLAYER COINCHE ***/
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

	this.play = function(name, card, callback){
		//<<<<<<<<<<<<<<< ASSERTS >>>>>>>>>>>>>>>>
  		assert(this.playersIndexes.indexOf(name)!=-1);
  		assert(this.playersIndexes.indexOf(name)===this.currentPlayer, " player is " + name + " but should be " + this.playersIndexes[this.currentPlayer]);
  		assert(AUTHORIZEDCARDS.indexOf(card)!=-1, 'AUTHORIZEDCARDS.indexOf(card): ' + AUTHORIZEDCARDS.indexOf(card) +' ' + card);
  		var cardIndex = this.players[name].cards.indexOf(card);
  		assert(cardIndex!=-1, 'User played '+card+' but available cards should be '+ this.players[name].cards);

		//<<<<<<<<<<<<<<< NOTIFY PLAYERS >>>>>>>>>>>>>>>>
		io.emit('played', {name: name, card:card});//TODO: Gérer les erreurs
		//<<<<<<<<<<<<<<< NOTIFY BELOTE IF SO >>>>>>>>>>>>>>>>
  		if (this.belote && name == this.playersIndexes[this.belote.player] && (Cards[card].value == 'Q' || Cards[card].value == 'K')){
  			io.emit('belote', {message:'', name:name, rebelote: this.belote.rebelote})
  			if (!this.belote.rebelote) this.belote.rebelote = true;
  		}
		//<<<<<<<<<<<<<<< REMOVE PLAYED CARD FROM PLAYER HAND >>>>>>>>>>>>>>>>
  		this.players[name].cards.splice(cardIndex, 1);
		
		//<<<<<<<<<<<<<<< PUSH THE CARD TO THE CURRENT TRICK >>>>>>>>>>>>>>>>
		this.currentTrick.push(card);//TODO : order 

		var endTrick = this.currentTrick.length == this.nbPlayers;
		if (endTrick) {
			//<<<<<<<<<<<<<<< MANAGE END OF THE TRICK >>>>>>>>>>>>>>>>
			this.endTrick();
		} else {
			//<<<<<<<<<<<<<<< CONTINUE PLAYING TILL END OF TRICK >>>>>>>>>>>>>>>>
			this.currentPlayer=(this.currentPlayer+1)%this.nbPlayers;
			io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('play', {message:'from this.play', cards: this.playableCards()});	
		}
		if (callback) callback();
	}
// ==============================================================
// ================== GAME MANAGEMENT ==========================
// ==============================================================
	/*** BEGIN NEXT JETEE ***/
	this.nextJetee = function(callback){
		this.distribute();
		this.currentTrump = '';
		this.currentAnnounce = {color:'', value:0,coinche:false, team:-1, playerName:''};

		for (pIndex in this.playersIndexes){
			var pName = this.playersIndexes[pIndex];
			io.to(users[pName].socket).emit('distribution', 
				{msg:'', cards: this.players[pName].cards, dealer: this.playersIndexes[this.currentDealer]});
		}

  		var winningAnnounce = {
  			value: this.currentAnnounce.value, 
  			color:this.currentAnnounce.color , 
  			playerName: this.currentAnnounce.playerName };
		
		io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('announce', { winningAnnounce:winningAnnounce, msg:''});
		
		if (callback) callback();
	}

	/*** WHEN A TRICK IS FINISHED ***/
	this.endTrick = function(){
		//<<<<<<<<<<<<<<< MANAGE END OF THE TRICK >>>>>>>>>>>>>>>>
		io.emit('end_trick', {message:'trick well ended', trick: this.currentTrick});
		//<<<<<<<<<<<<<<< COMPUTE TRICK WINNER >>>>>>>>>>>>>>>>
		var winner = (this.trickWinner().index+this.firstTrickPlayer)%this.nbPlayers;
		//<<<<<<<<<<<<<<< COMPUTE SCORES >>>>>>>>>>>>>>>>
		var endJetee = this.currentTrickIndex == 7;
		this.scores[this.players[this.playersIndexes[winner]].team].jetee += trickValue(this.currentTrick, this.currentTrump, endJetee);
		this.scores[0].trick = 0;
		this.scores[1].trick = 0;
		//<<<<<<<<<<<<<<< MANAGE DECK >>>>>>>>>>>>>>>>
		this.collectCards(this.players[this.playersIndexes[winner]].team);
		this.currentTrick = [];
		if (endJetee) {
		//<<<<<<<<<<<<<<< MANGE END OF THE JETEE >>>>>>>>>>>>>>>>
			this.endJetee();
		} else {
		//<<<<<<<<<<<<<<< CONTINUE NEXT TRICK >>>>>>>>>>>>>>>>
			this.currentPlayer = winner;
			this.currentTrickIndex++;
			this.firstTrickPlayer = this.currentPlayer;
			io.to(users[this.playersIndexes[this.currentPlayer]].socket).emit('play', {message:'from this.endTrick', cards: this.playableCards()});	
		}

	}
	
	/*** COMPUTES WHETHER THERE IS A BELOTE ON THE BEGINING OF A JETEE ***/
	this.isThereABelote = function(){
		if (this.currentTrump == 'AT' || this.currentTrump == 'NT') return false;
		
		for (pName in this.players){
			// FOR EACH PLAYER
			var cards = this.players[pName].cards;
			for (var j = 0; j < cards.length; j++) {
				//FOR EACH OF HIS CARD
				var card = Cards[cards[j]];
				if (card.color == this.currentTrump){
					//IF THIS CARD IS TRUMP
					
					//IF HE HAS THE KING
					if (card.value == 'K'){
						for (var k = j+1; k < cards.length; k++){
							var secondCard=Cards[cards[k]];
							if (secondCard.value == 'Q' && secondCard.color == this.currentTrump){
							//AND THE QUEEN
								return this.belote = {player : this.playersIndexes.indexOf(pName), rebelote: false};
							//THERE IS A BELOTE
							}
						}
						//IS HE HAS ONLY THE KING THERE IS NO BELOTE FOR NO ONE
						return false;	
					}
					//SAME WITCH QUEEN AT FIRST
					if (card.value == 'Q'){
						for (var k = j+1; k < cards.length; k++){
							var secondCard=Cards[cards[k]];
							if (secondCard.value == 'K' && secondCard.color == this.currentTrump){
								return this.belote = {player : this.playersIndexes.indexOf(pName), rebelote: false};
							}
						}
						return false;
					}
				}
			}
		}
	}

	/*** WHEN A JETEE IS FINISHED ***/
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

		this.nextJetee();
	}
	/*** WHEN A MATCH IS FINISHED ***/
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

	/*** RETURNS THE CARDS THAT CAN BE PLAYED BY THE CURRENT PLAYER ***/
	this.playableCards = function(){
		var thisPlayer = this.players[this.playersIndexes[this.currentPlayer]];
		
		//FIRST TO PLAY -> ALL CARDS
		if (this.firstToPlay()) return thisPlayer.cards;

		var colorPlayedCards = cardsOfColor(thisPlayer.cards,this.colorPlayed());
		//IF HE HAS THE COLOR
		if (colorPlayedCards.length > 0){
			//AND ORDER LIKE TRUMPS
			if ((this.colorPlayed()==this.currentTrump) || this.currentTrump == 'AT'){
				//MANAGE TRUMP ORDER
				return manageTrumps(this.currentTrick, thisPlayer.cards, this.currentTrump,this.colorPlayed());
			}
			//IF NO TRUMP RETURN ALL CARDS OF THE COLOR
			return colorPlayedCards;
		}

		//IF I DO NOT HAVE THE COLOR
		//AND IF MY PARTNER IS WINNING
		if (this.partnerIsWinning()) return thisPlayer.cards;
		//RETURN ALL CARDS
		
		//IF THE OTHER TEMA IS WINNING
		var trumpPlayedCards = cardsOfColor(thisPlayer.cards,this.currentTrump);
		//IF I CAN CUT
		if(trumpPlayedCards.length>0){
			//MANAGE TRUMP ORDER
			return manageTrumps(this.currentTrick, thisPlayer.cards, this.currentTrump,this.colorPlayed());
		}
		//IF I CANNOT CUT RETURN ALL CARDS
		return thisPlayer.cards;
	}

	/*** RETURNS THE COLOR OF THE FIRST CARD OF THE TRICK ***/
	this.colorPlayed = function(){
		if (!this.currentTrick[0])  return '';
		return Cards[this.currentTrick[0]].color;
	}
	
	/*** RETURN TRUE IF CURRENT PLAYER IS FIRST TO PLAY ***/
	this.firstToPlay = function(){
  		return this.currentTrick.length == 0;
	}

	/*** RETURN TRUE IF THE CURRENT PLAYER4S PARTNER IS WINNING THE TRICK ATM ***/
	this.partnerIsWinning = function(){ 
		var len = this.currentTrick.length;
		if (len >=2){
			return this.trickWinner().index == len - 2;
		}
		return false;
	}

	/*** RETURN THE CARD INDEX OF THE CURRENT WINNING CARD OF THE TRICK ***/
	this.trickWinner = function(){
		var defaultOrder = (this.currentTrump == 'AT'?'trumpOrder':'order');//if AT or NT, always defaultOrder

		var cut = false;
		var max = 0;
		var winnerIndex = 0;
		var winningCard = {};
		for (index in this.currentTrick){
			var card = Cards[this.currentTrick[index]];

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

	/*** MANAGE RECONNECTION TO A GAME ***/
	this.reconnect = function(name){
		assert(this.players[name]);

		//INITIAL GAME DATA
		io.to(users[name].socket).emit('initialize_game', 
			{msg:'', players: this.playersIndexes, dealer: this.playersIndexes[this.currentDealer]});
		//CURRENT PLAYER HAND
		io.to(users[name].socket).emit('distribution', 
				{msg:'', cards: this.players[name].cards, dealer: this.playersIndexes[this.currentDealer]});
		//CURRENT PLAYED CARDS
		var currentTrickCards = {};
		for (pIndex in this.currentTrick){
			var playerIndex = (parseInt(pIndex)+this.firstTrickPlayer)%this.nbPlayers;
			currentTrickCards[this.playersIndexes[playerIndex]] = this.currentTrick[pIndex];
		}
		io.to(users[name].socket).emit('display_current_trick', { cards:currentTrickCards, msg:'current trick is ...'});
		//SCORES
		var scoresToSend = [];
		scoresToSend.push(this.scores[this.players[name].team]);
		scoresToSend.push(this.scores[(this.players[name].team+1)%2]);
		scoresToSend[0].jetee = 0;
		scoresToSend[1].jetee = 0;
		io.to(users[name].socket).emit('scores', {message:'current scores', scores:scoresToSend});
		//CURRENTLY WINNING ANNOUNCE
		var winningAnnounce = {value: this.currentAnnounce.value, color:this.currentAnnounce.color , playerName: this.currentAnnounce.playerName};
		io.emit('announced', { winningAnnounce: winningAnnounce, value:winningAnnounce.value, color:winningAnnounce.color, name:winningAnnounce.playerName, msg:''});
		//THE CHOSEN TRUMP IF WE FINISHED ANNOUNCING AND ARE PLAYING
		if (this.currentTrump) {
			io.to(users[name].socket).emit('chosen_trumps', 
							{msg:'', color: this.currentAnnounce.color, value: this.currentAnnounce.value, coinche: this.currentAnnounce.coinche});
		}
		
		//IF IT IS THAT PLAYERS TURN TO ANNOUNCE OR PLAY
		if (this.playersIndexes[this.currentPlayer] == name ){
			if (this.currentTrump){
				io.to(users[name].socket).emit('play', {message:'', cards: this.playableCards()});	
			} else {
  				var winningAnnounce = {value: this.currentAnnounce.value, color:this.currentAnnounce.color , playerName: this.currentAnnounce.playerName};
				io.to(users[name].socket).emit('announce', { winningAnnounce:winningAnnounce, msg:'next announce'});//TODO: pas bon choix en théorie car peut jouer quune partie a la foi... donc server devrait sen rappeler
			}
		}
	}
	
	/*** MANAGE GAME LEAVER ***/
	this.leaveGame = function(name){
		assert(this.players[name]);
		//TODO: ROOM MODE -> wait all player left to kill the room;
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
// ==============================================================
// ================== USEFULL FUNCTIONS ===================================
// ==============================================================

/*** RETURNS THE SUBTABLE OF @CARDS OF THE COLOR @COLOR ***/
function cardsOfColor (cards, color){
	var targetCards = [];
	cards.forEach(function(card){
		if (Cards[card].color == color){
			targetCards.push(card);
		}
	});
	return targetCards;
}

/*** RETURNS THE SUBTABLE OF @AVAILABLECARDS CORRESPONDING TO WHAT CAN BE PLAYED, WHEN THE PLAYER HAS TO PLAY A CARD WITH TRUMPORDER ***/
function manageTrumps(playedCards, availableCards, trumpColor, playedColor){
	//COMPUTE THE GREATEST CARD IN THE TRUMP
	var maxTrump = 0;
	playedCards.forEach(function(card){
		if (Cards[card].color == trumpColor || (trumpColor == 'AT' && Cards[card].color == playedColor)) {
			if (Cards[card].trumpOrder > maxTrump) maxTrump = Cards[card].trumpOrder;
		}
	});
	if(maxTrump == 0) return cardsOfColor(availableCards, trumpColor);

	//SPLIT THE CARDS OF THIS COLOR LOWER OR GREATER THAN THE MAX VALUE
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
	//IF THERE ARE GREATER CARDS RETURN THEM, ELSE RETURN THE LOWER ONES
	return (upperTrumps.length>0?upperTrumps:lowerTrumps);
}

/*** RETURNS THE VALUE OF THE @TRICK CONSIDERATING THE TRUMP COLOR IS @TRUMP AND IT @ISLASTTRICK OR NOT ***/
function trickValue(trick, trump, isLastTrick){
	var res = 0;
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
	if (isLastTrick) res += 10;
	return res;
}

/*** NOTIFY ALL USERS OF THE NEW @STATUS OF THE PLAYER NAMED @NAME ***/
function updateStatus(name, status){
	users[name].status = status;
	for (index in users){
		io.to(users[index].socket).emit('user_status', {user:{name:name,status:status}});
	}
}