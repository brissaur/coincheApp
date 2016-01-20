// ==============================================================
// ================== GLOBAL VARS ===============================
// ==============================================================
var socket = io();
var dealer;
// var players = [];
var places = {};
var pseudo = '';

// <<<<<<<<<<<< Send chat message >>>>>>>>>>>>>>
$('form').submit(function(){
  socket.emit('chat_message', {message: $('#m').val()});
  $('#m').val('');
  return false;
});
function invitePlayers(){
  //select players
  // console.log(confirm('machin' + 'invited you for a game. Do you want to join?'));
  socket.emit('game_invitation', {players: []});
}

// <<<<<<<<<<<< Receive game invitation >>>>>>>>>>>>>>
// socket.on('game_invitation', function(msg){//gameID, name, 
//   $('#messages').append($('<li>').text(msg.name + ' invited you for game ' + msg.gameID));//TODO EVOL scroll down auto
//   socket.emit('game_invitation_' + (confirm(msg.name + ' invited you for a game. Do you want to join?')?'accepted':'refused'),{gameID: msg.gameID, msg:''});
// });
// <<<<<<<<<<<< Receive chat message >>>>>>>>>>>>>>
socket.on('chat_message', function(msg){
  $('#messages').append($('<li>').text(msg.name + ': ' +msg.message));//TODO EVOL scroll down auto
});
// <<<<<<<<<<<< Manage authentification >>>>>>>>>>>>>>
// socket.on('identification_required', function(msg){
//   // console.log(pseudo);
//   // while(pseudo=='' ||pseudo==null){pseudo = prompt('What is your pseudo?');}//KO
//   socket.emit('connection', {name: pseudo}); 
// });
// <<<<<<<<<<<< Manage new connection >>>>>>>>>>>>>>
socket.on('connection', function(msg){
  $('#messages').append($('<li>').text(msg.name + ' is connected.'));
});
// <<<<<<<<<<<< Manage new disconnection >>>>>>>>>>>>>>
socket.on('disconnection', function(msg){
  $('#messages').append($('<li>').text(msg.name + ' disconnected.'));
});

// <<<<<<<<<<<< Manage my turn to play >>>>>>>>>>>>>>
socket.on('play', function(msg){
    var card = prompt('What do you want to play?');
    socket.emit('play', {card: card});
});
// <<<<<<<<<<<< Manage game initialization >>>>>>>>>>>>>>
socket.on('initialize_game', function(msg){
  $('#messages').append($('<li>').text('Starting Game...'));
  // var dealer = msg.dealer;//TODO button
  var myIndex = msg.players.indexOf(pseudo);
  var positions = ['bottomPlayer', 'leftPlayer', 'topPlayer', 'rightPlayer'];
  for (var i = 0; i <4; i++) {
    playername = msg.players[(i+myIndex)%4];
    places[playername]=positions[i];
    console.log('places['+playername+']='+places[playername]);
    document.getElementById(positions[i]).childNodes[1].innerHTML=playername;
  };
});
// <<<<<<<<<<<< Manage a player played >>>>>>>>>>>>>>
socket.on('played', function(msg){
  document.getElementById(places[msg.name]).childNodes[0].src='/images/cards/'+msg.card+'.png';
});
// <<<<<<<<<<<< Manage end of a trick >>>>>>>>>>>>>>
socket.on('end_trick', function(msg){
  $('#messages').append($('<li>').text(msg.message));
  for(divs in places){
    document.getElementById(places[divs]).childNodes[0].src='';
  }
});

