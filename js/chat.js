// ==============================================================
// ================== GLOBAL VARS ===============================
// ==============================================================
var socket = io();
var dealer;
// var players = [];
var positions = ['bottomPlayer', 'leftPlayer', 'topPlayer', 'rightPlayer'];
var places = {};
var cards = [];
var pseudo = '';

// <<<<<<<<<<<< Mise en forme du jeu du joueur >>>>>>>>>>>>>>
var zindex=10;
var shiftLeft=0;

  for (var i = 0; i < 8; i++) {
    // console.log('card'+i);
    c=$('#card'+i);
    c.css('z-index', zindex);
    c.css('left', shiftLeft+100);
    zindex*=10;
    shiftLeft+=30;
  }




$.get('/connectedUsers',function(data){
    data.forEach(function(user){
      $('#userList').append($('<li>').text(user));
    })
});

// <<<<<<<<<<<< Send chat message >>>>>>>>>>>>>>
$('form').submit(function(){
  socket.emit('chat_message', {message: $('#m').val()});
  $('#m').val('');
  return false;
});
function invitePlayers(){
  //select players
  // console.log(confirm('machin' + 'invited you for a game. Do you want to join?'));
  socket.emit('game_invitation', {players: ['a','b','c','d']});
}

// <<<<<<<<<<<< Receive game invitation >>>>>>>>>>>>>>
socket.on('game_invitation', function(msg){//gameID, name, 
  $('#messages').append($('<li>').text(msg.name + ' invited you for game ' + msg.gameID));//TODO EVOL scroll down auto
  socket.emit('game_invitation_' + (confirm(msg.name + ' invited you for a game. Do you want to join?')?'accepted':'refused'),{gameID: msg.gameID, msg:''});
});
socket.on('game_invitation_cancelled', function(msg){//gameID, name, 
  $('#messages').append($('<li>').text('Game was cancelled by ' + msg.name));//TODO EVOL scroll down auto
});
// <<<<<<<<<<<< Receive chat message >>>>>>>>>>>>>>
socket.on('chat_message', function(msg){
  $('#messages').append($('<li>').text(msg.name + ': ' +msg.message));//TODO EVOL scroll down auto
  // $('#chatWindow').animate({scrollTop: $('#chatWindow').prop(&quot;scrollHeight&quot;)}, 500);
});

// socket.on('chat message', function(msg){
//     $('#messages').append($('<li>').text(msg));
//   });

// <<<<<<<<<<<< Manage authentification >>>>>>>>>>>>>>
// socket.on('identification_required', function(msg){
//   // console.log(pseudo);
//   // while(pseudo=='' ||pseudo==null){pseudo = prompt('What is your pseudo?');}//KO
//   socket.emit('connection', {name: pseudo}); 
// });
// <<<<<<<<<<<< Manage new connection >>>>>>>>>>>>>>
socket.on('connection', function(msg){
  $('#messages').append($('<li>').text(msg.name + ' is connected.'));
  $('#userList').append($('<li>').text(msg.name));
  //TODO sort
});
socket.on('connection_accepted', function(msg){
  // $('#userList').append($('<li>').text(msg.name));
  pseudo=msg.name;
});
socket.on('connection_refused', function(msg){
  $('#messages').append($('<li>').text(msg.message));
});
// <<<<<<<<<<<< Manage new disconnection >>>>>>>>>>>>>>
socket.on('disconnection', function(msg){
  $('#messages').append($('<li>').text(msg.name + ' disconnected.'));
  $('#userList').children().each(function(index, element){//TODO pb si aucun enfant;
      // console.log(this.text);
      // console.log(index);
      // console.log(element);
      // console.log($(this).text());
      // console.log(element.text());
      if($(this).text()==msg.name){
        // $(this).parents().removeChild($(this));
        $(this).remove();
      }
    });
});

// <<<<<<<<<<<< Manage my turn to play >>>>>>>>>>>>>>
socket.on('play', function(msg){
      timeToPlay(msg.gameID, msg.cards);
});
// <<<<<<<<<<<< Manage game initialization >>>>>>>>>>>>>>
socket.on('initialize_game', function(msg){//cards, players, dealer
  // var dealer = msg.dealer;//TODO button
  // debugger;
  console.log(msg);
  console.log({pseudo: pseudo});
  var myIndex = msg.players.indexOf(pseudo);
  cards = msg.cards;
  // $('#messages').append($('<li>').text('Starting Game...' + cards));
  for (var i = 0; i <msg.players.length; i++) {
    var playername = msg.players[(i+myIndex)%msg.players.length];
    console.log(playername);
    console.log({i: i, myIndex: myIndex, nbPlayers:msg.players.length});
    places[playername]=positions[i];
    // console.log('places['+playername+']='+places[playername]);
    document.getElementById(positions[i]).childNodes[0].innerHTML=playername;
  };
  distribute(cards);
});
// <<<<<<<<<<<< Manage a player played >>>>>>>>>>>>>>
socket.on('played', function(msg){
  var targetCard = document.getElementById(places[msg.name]);
  // console.log('played');
  var c = document.createElement('img');
    c.src='/images/cards/'+msg.card+'.png';
    c.className = "card";
  //   c.style['z-index']=zindex
  //   c.style.left=shiftLeft+100;//('left', shiftLeft+100);
  //   zindex*=10;
  //   shiftLeft+=30;
    targetCard.appendChild(c);
  // .childNodes[0].src='/images/cards/'+msg.card+'.png';
});
// <<<<<<<<<<<< Manage end of a trick >>>>>>>>>>>>>>
socket.on('end_trick', function(msg){
  $('#messages').append($('<li>').text(msg.message));
  for(divs in places){
    var child = document.getElementById(places[divs]).childNodes[1];
    if (child){
      child.parentNode.removeChild(child);
    }
    // document.getElementById(places[divs]).childNodes[0].src='';
  }
});
socket.on('end_jetee', function(msg){
  $('#messages').append($('<li>').text(msg.message));
  distribute(cards);
  // for(divs in places){
  //   var child = document.getElementById(places[divs]).childNodes[1];
  //   if (child){
  //     child.parentNode.removeChild(child);
  //   }
    // document.getElementById(places[divs]).childNodes[0].src='';
});

