var socket = io();
var dealer;
// var players = [];
var places = {};
var pseudo = '';
$('form').submit(function(){
  socket.emit('chat_message', {message: $('#m').val()});
  $('#m').val('');
  return false;
});

socket.on('chat_message', function(msg){
  $('#messages').append($('<li>').text(msg.name + ': ' +msg.message));//TODO EVOL scroll down auto
});
socket.on('identification_required', function(msg){
  console.log(pseudo);
  while(pseudo=='' ||pseudo==null){pseudo = prompt('What is your pseudo?');}//KO
  socket.emit('connection', {name: pseudo}); 
});
socket.on('connection', function(msg){
  $('#messages').append($('<li>').text(msg.name + ' is connected.'));
});
socket.on('disconnection', function(msg){
  $('#messages').append($('<li>').text(msg.name + ' disconnected.'));
});

socket.on('play', function(msg){
  // $('#messages').append($('<li>').text('game start with player ' + msg.name));
    // console.log('My turn to play...');
    var card = prompt('What do you want to play?');
    socket.emit('play', {card: card});
});
socket.on('initialize_game', function(msg){
  $('#messages').append($('<li>').text('Starting Game...'));
  // var dealer = msg.dealer;//TODO button
  // // var players = msg.players;
  var myIndex = msg.players.indexOf(pseudo);
  var positions = ['bottomPlayer', 'leftPlayer', 'topPlayer', 'rightPlayer'];
  for (var i = 0; i <4; i++) {
    playername = msg.players[(i+myIndex)%4];
    places[playername]=positions[i];
    console.log('places['+playername+']='+places[playername]);
    document.getElementById(positions[i]).childNodes[1].innerHTML=playername;
  };
});
socket.on('played', function(msg){
  // $('#messages').append($('<li>').text(msg.name + ' played ' + msg.card));
  // debugger;
  document.getElementById(places[msg.name]).childNodes[0].src='/images/cards/'+msg.card+'.png';
  // $(places[name]+' img').src='/images/cards/'+ msg.card +'.png';
});
socket.on('end_trick', function(msg){
  $('#messages').append($('<li>').text(msg.message));
  for(divs in places){
    document.getElementById(places[divs]).childNodes[0].src='';
  }
});

