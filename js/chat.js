// ==============================================================
// ================== GLOBAL VARS ===============================
// ==============================================================
 // $('<input />', ).appendTo(container);

var socket = io();
var dealer;
// var players = [];
var positions = ['bottomPlayer', 'leftPlayer', 'topPlayer', 'rightPlayer'];
var places = {};
var cards = [];
var pseudo = '';
var gameID = -1;
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
      $('#userList').append($('<li>').text(user).append($('<input />', { type: 'checkbox', value: user})));
      //.attr('checked', false);//TODO
 // $('#userList').append($('<input />', { type: 'checkbox', value: 'robiiin' , text: 'test'}).text('aefz'));

    })
});

// <<<<<<<<<<<< Send chat message >>>>>>>>>>>>>>
$(document).keypress(function(e) {
    var elem = $('#messageForm')
    if(e.which == 13) {//if it is enter;
      if (elem.hasClass('hidden')){
        e.preventDefault();
        elem.removeClass('hidden');
        $('#messageInput').focus();
      } else {
        elem.addClass('hidden');
      }
    }
});
$('form').submit(function(){
  socket.emit('chat_message', {message: $('#messageInput').val()});
  $('#messageInput').val('');
  return false;
});
function invitePlayers(){
  //select players
  var players = [];
  $(':checkbox:checked').each(function(index, element){//TODO pb si aucun enfant;
    players.push($(this).val());
  });
  $(':checkbox:checked').attr('checked', false);
  if(players.length>0) socket.emit('game_invitation', {players: players});
}

// <<<<<<<<<<<< Receive game invitation >>>>>>>>>>>>>>
socket.on('game_invitation', function(msg){//gameID, name, 
  gameID=msg.gameID;
  $('#inviteBoard').removeClass('hidden');
  $('#inviteBoard p').text(msg.name + ' invited you for a game.');
  $('#messages').append($('<li>').text(msg.name + ' invited you for game ' + msg.gameID));//TODO EVOL scroll down auto
});
socket.on('game_invitation_cancelled', function(msg){
  $('#inviteBoard').addClass('hidden');
  gameID=-1;
  $('#messages').append($('<li>').text('Game was cancelled by ' + msg.name));//TODO EVOL scroll down auto
});

    function acceptInvite(){
      socket.emit('game_invitation_accepted',{gameID: gameID, msg:''});
      gameID = -1;
      $('#inviteBoard').addClass('hidden');
    }
    function refuseInvite(){
      socket.emit('game_invitation_refused',{gameID: gameID, msg:''});
      gameID = -1;
      $('#inviteBoard').addClass('hidden');
    }
// <<<<<<<<<<<< Receive chat message >>>>>>>>>>>>>>
socket.on('chat_message', function(msg){
  var elem = $('<li>').text(msg.name + ': ' +msg.message);
  $('#messages').append(elem);//TODO EVOL scroll down auto
  var initialPos = $('#chatWindow').position();
  $('#chatWindow').css({top: initialPos.top-30});
  $("#mydiv").css({top: 200, left: 200});
  setTimeout(function(){
    elem.hide(1000, function(){
      elem.remove();
      var initialPos = $('#chatWindow').position();
      $('#chatWindow').css({top: initialPos.top+30});
    });
  }, Math.max(5000,elem.text().length*150));
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
  $('#userList').append($('<li>').text(msg.name).append($('<input />', { type: 'checkbox', value: msg.name})));

  // $('#userList').append($('<li>').text(msg.name));
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
      if($(this).text()==msg.name){
        $(this).remove();
      }
    });
});

// <<<<<<<<<<<< Manage my turn to play >>>>>>>>>>>>>>
socket.on('play', function(msg){
      timeToPlay(msg.gameID, msg.cards);

});

socket.on('announce', function(msg){
      // alert('announce');
      timeToAnnounce(msg.gameID, msg.lastAnnounce);
      console.log('announce : ' + msg.msg);
});

socket.on('announced', function(msg){
  $('#'+ places[msg.name] + ' .announce').text(' ' + (msg.value==0?'Pass':msg.value + msg.color));
});
socket.on('coinche', function(msg){
  $('#'+ places[msg.name] + ' .announce').text('Coinched!');
});

// <<<<<<<<<<<< Manage game initialization >>>>>>>>>>>>>>
socket.on('initialize_game', function(msg){//cards, players, dealer
  // var dealer = msg.dealer;//TODO button
  // debugger;
  var myIndex = msg.players.indexOf(pseudo);
  // $('#messages').append($('<li>').text('Starting Game...' + cards));
  for (var i = 0; i <msg.players.length; i++) {
    var playername = msg.players[(i+myIndex)%msg.players.length];
    places[playername]=positions[i];
    // console.log('places['+playername+']='+places[playername]);
    // document.getElementById(positions[i]).childNodes[0].innerHTML=playername;
    $('#'+ places[playername] + ' .playerName').text(playername)
  };
});
socket.on('distribution', function(msg){//cards, players, dealer
  distribute(msg.cards);
  console.log('distribution: ' + msg.cards);
  // display COINCHER area
});
socket.on('chosen_trumps', function(msg){//value, color
  // undisplay COINCHER area or chosetrumps area
  if (msg.value == 0){
    $('#playerCards').children().each(function(index, element){
        if($(this).is('img')){
          $(this).remove();
        }
    });
  } else {
    $('#messages').append($('<li>').text(' Chosen trumps: ' + msg.color));
  }

  for (pName in places){
    $('#'+ places[pName] + ' .announce').text('');
  }
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
    $('#' + places[divs] + ' img').remove();
    // var child = document.getElementById(places[divs]).childNodes[1];
    // if (child){
    //   child.parentNode.removeChild(child);
    // }
    // document.getElementById(places[divs]).childNodes[0].src='';
  }
});
socket.on('end_jetee', function(msg){
  $('#messages').append($('<li>').text(msg.message));
  updateScores(msg.scores);
});

function updateScores(scores){
  $('#scoreUsGame').text(scores[0].game);
  $('#scoreUsMatch').text(scores[0].match);
  $('#scoreUsJetee').text(scores[0].jetee);
  $('#scoreThemGame').text(scores[1].game);
  $('#scoreThemMatch').text(scores[1].match);
  $('#scoreThemJetee').text(scores[1].jetee);
}
