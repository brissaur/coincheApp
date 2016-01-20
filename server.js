var express = require('express');
	var app = express();
		app.use(express.static(__dirname));//define static default path
var http = require('http').Server(app);
var jade = require('jade');
  app.set('view engine', 'jade');
var io = require('socket.io')(http);

var assert = require('assert');
ent = require('ent'); // Permet de bloquer les caractères HTML (sécurité équivalente à htmlentities en PHP)
// ==========================================
var MAXPLAYER=4;
app.get('/', function(req, res){
  res.render('index');
});

//je dois match un socket ID a un joueur!!
//--> je recois un msg, il joue dans tel game
var rooms = {};
var Room = {
	players : [],//socket ID
	currentPlayer : null,
	currentDealer : null,
	firstTrickPlayer : null
	// sockets : [],
}
var users = [];//iid = socketId
var User = {
	id: '',//socket ID
	name: ''
}
//LE CHAT
io.on('connection', function(socket){
	console.log('new connection');
	socket.emit('identification_required',{});
	socket.on('connection', function(data) {
		name = ent.encode(data.name);
   		console.log(name + ' is connected with socket ' + socket.id);

		users[socket.id] = {id: socket.id, name: name};
		Room.players.push(socket.id);

		socket.emit('connection_accepted', {message:'Connection accepted'});
		socket.broadcast.emit('connection', {name: name});
		if(Room.players.length==MAXPLAYER){

			rand=Math.floor((Math.random() * MAXPLAYER));
			Room.currentDealer=rand;
			Room.firstTrickPlayer=(rand+1)%MAXPLAYER;
			Room.currentPlayer=(rand+1)%MAXPLAYER;
			console.log('initialize_game');
			var playersToSend = [];
			for (var i = 0; i < Room.players.length; i++) {
				assert(Room.players[i] != null, 'Room.players[i] is null');
				playersToSend.push(users[Room.players[i]].name);
			};

			
			// function functionTO(){
			// 	socketid = Room.players[Math.floor(Math.random() * 4)];
			// 	// io.sockets.connected[socketid].emit('chat_message', {name:'server',message:'randomly targeted socket'});
			// 	io.to(socketid).emit('chat_message', {name:'server',message:'randomly targeted socket'});
			// 	console.log(socketid);
			// 	setTimeout(functionTO, 2000);
			// }
			io.emit('initialize_game', {players: playersToSend, dealer: Room.currentDealer});
			
			io.to(Room.players[Room.currentPlayer]).emit('play', {});
		}
    });
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
	socket.on('chat_message', function(msg){
	    console.log('Chat message from '+ users[socket.id].name + ': '+ msg.message);
	    io.emit('chat_message', {name: users[socket.id].name, message: msg.message});//TODO EVOL roadcast+print local
  	});
  	socket.on('play', function(msg){//.card + .player + .firstPlayer
  		console.log(' play attempt ');
  		assert(Room.players.indexOf(socket.id)===Room.currentPlayer, 'Its not that player s turn...' + Room.players.indexOf(socket.id)+'==!'+Room.currentPlayer);
  // 		var playerId = ((msg.playerId?msg.playerId:players.indexOf(socket.id))+1)%4;
	 //    console.log(users[socket.id].name + ' played '+ msg.card);
		io.emit('played', {name: users[socket.id].name, card:msg.card});
		if (Room.firstTrickPlayer==((Room.currentPlayer+1)%4)){
			setTimeout(function(){
				console.log('endTrick');
				io.emit('end_trick', {message:'trick well ended'});
				Room.currentPlayer = Math.floor((Math.random() * 4));//TODO EVOL: calculé quia  gagné le pli
				Room.firstTrickPlayer = Room.currentPlayer;
				io.to(Room.players[Room.currentPlayer]).emit('play', {});	
			},2000);
		} else {
			Room.currentPlayer=(Room.currentPlayer+1)%4;
			io.to(Room.players[Room.currentPlayer]).emit('play', {});	
		}
			// io.sockets.connected[Room.players[Room.currentPlayer]].emit("chat_message",{name: 'server', message:'ITs turn to play to ' + users[Room.players[Room.currentPlayer]].name});
			// io.to(Room.players[Room.currentPlayer]).emit('chat_message', {name:'server',message:'Your turn to play'});


		// if (false){//lastcard
		// 	//compute trick
	 //    	io.emit('trick_win', {name: null, message: null});//TODO EVOL roadcast+print local
		// 	if (false){//last trick
	 //    		io.emit('jetee_end', {trickScores: {0,0}, trickWinner: null, scores: {0,0}, winner:'', message: null});//TODO EVOL roadcast+print local
	 //    		// io.emit('jetee_start', {scores: {0,0}, winner: null, message: null});//TODO EVOL roadcast+print local

		// 	}
		// }
  	});
});


//LISTEN
http.listen(3000, function(){
  console.log('listening on *:3000');
});