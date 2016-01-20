// ==============================================================
// ================== REQUIRES ==================================
// ==============================================================

var express = require('express');
	var app = express();
		app.use(express.static(__dirname));//define static default path
var http = require('http').Server(app);
var jade = require('jade');
  app.set('view engine', 'jade');
var io = require('socket.io')(http);

var assert = require('assert');
var ent = require('ent'); // Permet de bloquer les caractères HTML (sécurité équivalente à htmlentities en PHP)
// ==========================================
// ==============================================================
// ================== GLOBAL VARS ===============================
// ==============================================================
var MAXPLAYER=4;
var TIMEUNIT = 1000;
var PORT = 3000;
var rooms = {};
var Room = {
	namespace:'',
	players : [],//socket ID
	currentPlayer : null,
	currentDealer : null,
	firstTrickPlayer : null
}
var users = [];//iid = socketId
// var User = {
// 	id: '',//socket ID
// 	name: ''
// }
// ==============================================================
// ================== ROUTES ====================================
// ==============================================================
app.get('/', function(req, res){
  res.render('index');
});


// ==============================================================
// ================== SOCKETS ===================================
// ==============================================================
io.on('connection', function(socket){
	// <<<<<<<<<<<< Ask for pseudo >>>>>>>>>>>>>>
	socket.emit('identification_required',{});
	// <<<<<<<<<<<< Manage new connection >>>>>>>>>>>>>>
	socket.on('connection', function(data) { //data = {name}
		name = ent.encode(data.name);
   		console.log(name + ' connected with socket ' + socket.id);

		users[socket.id] = {id: socket.id, name: name};
		Room.players.push(socket.id);

		socket.emit('connection_accepted', {message:'Connection accepted'});//when connection refused? how?
		socket.broadcast.emit('connection', {name: name});
		// if(Room.players.length==MAXPLAYER){//start game

		// 	rand=Math.floor((Math.random() * MAXPLAYER));
		// 	Room.currentDealer=rand;
		// 	Room.firstTrickPlayer=(rand+1)%MAXPLAYER;
		// 	Room.currentPlayer=(rand+1)%MAXPLAYER;
		// 	console.log('initialize_game');
		// 	var playersToSend = [];
		// 	for (var i = 0; i < Room.players.length; i++) {
		// 		assert(Room.players[i] != null, 'Room.players[i] is null');
		// 		playersToSend.push(users[Room.players[i]].name);
		// 	};
		// 	io.emit('initialize_game', {players: playersToSend, dealer: Room.currentDealer});
		// 	io.to(Room.players[Room.currentPlayer]).emit('play', {});
		// }
    });
	// <<<<<<<<<<<< Manage disconnection >>>>>>>>>>>>>>
	socket.on('disconnect', function(){
		if (users[socket.id]){
			name=users[socket.id].name;
			users[socket.id]=null;
		}else{
			name='visitor';
		}
   		console.log(name + ' disconnected.');
		socket.broadcast.emit('disconnection', {name:name});
	});
	// <<<<<<<<<<<< Manage chat message >>>>>>>>>>>>>>
	socket.on('chat_message', function(msg){
	    console.log('Chat message from '+ users[socket.id].name + ': '+ msg.message);
	    io.emit('chat_message', {name: users[socket.id].name, message: msg.message});//TODO EVOL roadcast+print local
  	});
	// <<<<<<<<<<<< Manage game invitation >>>>>>>>>>>>>>
	// socket.on('game_invitation', function(msg){
	// 	//créer un namespace ET SEN RAPELLER
	//     console.log('Game invitation from '+ users[socket.id].name + ' for '+ msg.players);
	//     var gameId = Math.floor((Math.random() * 1000));
	//     io.emit('game_invitation', {name: users[socket.id].name, message: '', gameID: gameID});//TODO EVOL roadcast+print local
	//     var gamePlayers = msg.players;
	//     gamePlayers.push(users[socket.id].name);
	//     rooms[gameID] = {players: gamePlayers, currentPlayer:null, currentDealer:null, firstTrickPlayer:null}//comment on check ils acceptent
 //  	});
	// socket.on('game_invitation_accepted', function(msg){
	//     console.log('Game invitation accepted by '+ users[socket.id].name);
	//     // io.emit('game_invitation', {name: users[socket.id].name, message: '', gameID: Math.floor((Math.random() * 1000))});//TODO EVOL roadcast+print local
 //  	});
	// socket.on('game_invitation_refused', function(msg){
	//     console.log('Game invitation refused by '+ users[socket.id].name);
	    
	//     rooms[gameID] = {players: gamePlayers, currentPlayer:null, currentDealer:null, firstTrickPlayer:null}//comment on check ils acceptent
	//     // io.emit('game_invitation', {name: users[socket.id].name, message: '', gameID: Math.floor((Math.random() * 1000))});//TODO EVOL roadcast+print local
 //  	});
	// <<<<<<<<<<<< Manage a player plays >>>>>>>>>>>>>>
  	socket.on('play', function(msg){//.card + .player + .firstPlayer
  		assert(Room.players.indexOf(socket.id)===Room.currentPlayer, 'Its not that player s turn...' + Room.players.indexOf(socket.id)+'==!'+Room.currentPlayer);
		io.emit('played', {name: users[socket.id].name, card:msg.card});
		if (Room.firstTrickPlayer==((Room.currentPlayer+1)%MAXPLAYER)){
			setTimeout(function(){
				console.log('endTrick');
				io.emit('end_trick', {message:'trick well ended'});
				Room.currentPlayer = Math.floor((Math.random() * MAXPLAYER));//TODO EVOL: calculé quia  gagné le pli
				Room.firstTrickPlayer = Room.currentPlayer;
				io.to(Room.players[Room.currentPlayer]).emit('play', {});	
			},2*TIMEUNIT);
		} else {
			Room.currentPlayer=(Room.currentPlayer+1)%MAXPLAYER;
			io.to(Room.players[Room.currentPlayer]).emit('play', {});	
		}
  	});
});


//LISTEN
http.listen(PORT, function(){
  console.log('listening on *:'+PORT);
});