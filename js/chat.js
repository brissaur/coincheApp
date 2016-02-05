// ==============================================================
// ================== GLOBAL VARS ===============================
// ==============================================================
var socket = io();
var positions = ['bottomPlayer', 'leftPlayer', 'topPlayer', 'rightPlayer'];
var places = {};
var cards = [];
var dealer;
var pseudo = '';
var zindex=10;
var shiftLeft=0;

  // for (var i = 0; i < 8; i++) {
  //   c=$('#card'+i);
  //   c.css('z-index', zindex);
  //   c.css('left', shiftLeft+100);
  //   zindex*=10;
  //   shiftLeft+=30;
  // }



$.get('/connectedUsers',function(data){
    data.forEach(function(user){
      $('#userList').append($('<li>').text(user).append($('<input />', { type: 'checkbox', value: user})));
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
  var msg = $('#messageInput').val();
  if (msg.trim().length > 0 ) socket.emit('chat_message', {message: msg});
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
socket.on('game_invitation', function(msg){// name, 
  $('#inviteBoard').removeClass('hidden');
  $('#inviteBoard p').text(msg.name + ' invited you for a game.');
  // $('#messages').append($('<li>').text());//TODO EVOL scroll down auto
  // displayMsg(msg);
});
socket.on('game_invitation_cancelled', function(msg){
  $('#inviteBoard').addClass('hidden');
  displayMsg('system','Game was cancelled by ' + msg.name);

});

    function acceptInvite(){
      socket.emit('game_invitation_accepted',{msg:''});
      $('#inviteBoard').addClass('hidden');
    }
    function refuseInvite(){
      socket.emit('game_invitation_refused',{msg:''});
      $('#inviteBoard').addClass('hidden');
    }
// <<<<<<<<<<<< Receive chat message >>>>>>>>>>>>>>
socket.on('chat_message', function(msg){
  displayMsg('chat', msg.name + ': ' +msg.message);
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
  displayMsg('system', msg.name + ' is connected.');
  $('#userList').append($('<li>').text(msg.name).append($('<input />', { type: 'checkbox', value: msg.name})));

  // $('#userList').append($('<li>').text(msg.name));
  //TODO sort
});
socket.on('connection_accepted', function(msg){
  // $('#userList').append($('<li>').text(msg.name));
  pseudo=msg.name;
});
socket.on('connection_refused', function(msg){
  displayMsg('system', msg.message);
});
// <<<<<<<<<<<< Manage new disconnection >>>>>>>>>>>>>>
socket.on('disconnection', function(msg){
  displayMsg('system', msg.name + ' disconnected.');
  $('#userList').children().each(function(index, element){//TODO pb si aucun enfant;
      if($(this).text()==msg.name){
        $(this).remove();
      }
    });
});

// <<<<<<<<<<<< Manage my turn to play >>>>>>>>>>>>>>
socket.on('play', function(msg){
      timeToPlay(msg.cards);

});

socket.on('announce', function(msg){
      // alert('announce');
      timeToAnnounce(msg.winningAnnounce);
      console.log('announce : ' + msg.msg);
});

socket.on('announced', function(msg){
  $('#'+ places[msg.name] + ' .announce').text(' ' + (msg.value==0?'Pass':msg.value + msg.color));
  console.log(msg.winningAnnounce);
  if (msg.winningAnnounce.value == 0){
    //nothing
  } else if (places[msg.winningAnnounce.playerName] == 'topPlayer' || places[msg.winningAnnounce.playerName] == 'bottomPlayer'){
    $('#bottomPlayer button').remove();
  } else { // si ils gagnent l'annonce actuelle
    if ($('#bottomPlayer button').length == 0){
      var coincheButton = $('<button>').attr('onClick', 'coinche()').text('coinche');
      $('#bottomPlayer').append(coincheButton);
    }
  }
});
socket.on('coinche', function(msg){
  $('#'+ places[msg.name] + ' .announce').text('Coinched!');//TODO: animate ...
  if(!$('#announceBoard').hasClass('hidden')) $('#announceBoard').addClass('hidden');
});

// <<<<<<<<<<<< Manage game initialization >>>>>>>>>>>>>>
socket.on('initialize_game', function(msg){//cards, players, dealer
  var myIndex = msg.players.indexOf(pseudo);
  console.log(msg.players);
  console.log(pseudo);
  for (var i = 0; i <msg.players.length; i++) {
    var playername = msg.players[(i+myIndex)%msg.players.length];
    places[playername]=positions[i];
    $('#'+ places[playername] + ' .playerName').text(playername)
  };
  dealer = msg.dealer;
  $('#' + places[msg.dealer]).append($('<span>').text('D').addClass('dealer'));
});
socket.on('distribution', function(msg){//cards, players, dealer
  distribute(msg.cards);
  console.log('distribution: ' + msg.cards);
  $('#' + places[dealer] + ' .dealer').remove();
  dealer = msg.dealer;
  $('#' + places[msg.dealer]).append($('<span>').text('D').addClass('dealer'));
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
    displayMsg('system',' Chosen trumps: ' + msg.color);//TODO
    $('#currentAnnounce').text(msg.value + ' ' + displayCardColor(msg.color) + (msg.coinche?' coinched': ''));
  }

  for (pName in places){
    $('#'+ places[pName] + ' .announce').text('');
  }
  $('#bottomPlayer button').remove();
});
// <<<<<<<<<<<< Manage a player played >>>>>>>>>>>>>>
socket.on('played', function(msg){
  var targetCard = document.getElementById(places[msg.name]);

  // console.log('played');
  var c = document.createElement('img');
    c.src='/images/cards/'+msg.card+'.png';
    c.className = "card";
    targetCard.appendChild(c);
});
socket.on('display_current_trick', function(msg){
  var cards = msg.cards;

  for (player in cards){
    var targetCard = document.getElementById(places[player]);
    var c = document.createElement('img');
    c.src='/images/cards/'+cards[player]+'.png';
    c.className = "card";
    targetCard.appendChild(c);
  }
});
// <<<<<<<<<<<< Manage end of a trick >>>>>>>>>>>>>>
socket.on('end_trick', function(msg){
  displayMsg('system',msg.message);
  for(divs in places){
    $('#' + places[divs] + ' img').remove();
  }
});
socket.on('end_jetee', function(msg){
  displayMsg('system',msg.message);
  updateScores(msg.scores);
  $('#currentAnnounce').text('');
});
socket.on('scores', function(msg){
  updateScores(msg.scores);
})
function updateScores(scores){
  $('#scoreUsGame').text(scores[0].game);
  $('#scoreUsMatch').text(scores[0].match);
  $('#scoreUsJetee').text(scores[0].jetee);
  $('#scoreThemGame').text(scores[1].game);
  $('#scoreThemMatch').text(scores[1].match);
  $('#scoreThemJetee').text(scores[1].jetee);
}

function displayMsg(type, msg){
var elem = $('<li>').text(msg);
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
}

function displayCardColor(letters){
  switch (letters){
    case 'H':
      return 'Hearts';
    case 'S':
      return 'Spades';
    case 'C':
      return 'Clubs';
    case 'D':
      return 'Diamonds';
    case 'AT':
      return 'All Trumps';
    case 'NT':
      return 'No Trumps';
    default:
      return;
  }
}