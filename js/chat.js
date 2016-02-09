// =========TEST==================


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

// ==============================================================
// ================== INITIAL SCRIPTS ===============================
// ==============================================================
// <<<<<<<<<<<< GET LIST CONNECTED USER >>>>>>>>>>>>>>
$.get('/connectedUsers',function(data){
    data.forEach(function(user){
      var elem = $('<li>').text(user.name);
      if (user.status == 'available') elem.append($('<input />', { type: 'checkbox', value: user.name}));
      $('#userList').append(elem);
    })

});
// ==============================================================
// ================== CHAT MESSAGE ===============================
// ==============================================================
// <<<<<<<<<<<< KEYPRESS ENTER: MANAGE chat message >>>>>>>>>>>>>>
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
// <<<<<<<<<<<< Receive chat message >>>>>>>>>>>>>>
socket.on('chat_message', function(msg){
  displayMsg('chat', msg.name + ': ' +msg.message);
});
// ==============================================================
// ================== CONNECTION ===============================
// ==============================================================
// <<<<<<<<<<<< Manage new connection >>>>>>>>>>>>>>
socket.on('connection', function(msg){
  displayMsg('system', msg.user.name + ' is connected.');

  var nbChildren = $('#userList').children().length;
  var elemToBeInserted = $('<li>').text(msg.user.name);
  if (msg.user.status == 'available') elemToBeInserted.append($('<input />', { type: 'checkbox', value: msg.user.name}));
  if (nbChildren == 0) {
      elemToBeInserted.appendTo('#userList');
      return false;
    
  }
  $('#userList').children().each(function(index, element){
    if (msg.user.name < $(element).text()){
        elemToBeInserted.insertBefore($(element));
        return false;
    }
    if (index == nbChildren - 1){
      elemToBeInserted.appendTo('#userList');
      return false;
    }
  });
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
// ==============================================================
// ================== GAME INVITATION ===============================
// ==============================================================
// <<<<<<<<<<<< Receive game invitation >>>>>>>>>>>>>>
socket.on('game_invitation', function(msg){// name, 
  $('#inviteBoard').removeClass('hidden');
  $('#inviteBoard p').text(msg.name + ' invited you for a game.');
});
socket.on('game_invitation_cancelled', function(msg){
  $('#inviteBoard').addClass('hidden');
  displayMsg('system','Game was cancelled by ' + msg.name);
});

function invitePlayers(){
  var players = [];
  $(':checkbox:checked').each(function(index, element){//TODO pb si aucun enfant;
    players.push($(this).val());
  });
  $(':checkbox:checked').attr('checked', false);
  if(players.length>0) socket.emit('game_invitation', {players: players});
}
function acceptInvite(){
  socket.emit('game_invitation_accepted',{msg:''});
  $('#inviteBoard').addClass('hidden');
}
function refuseInvite(){
  socket.emit('game_invitation_refused',{msg:''});
  $('#inviteBoard').addClass('hidden');
}


// ==============================================================
// ================== ACTION FROM THIS USER ===================
// ==============================================================
/*** USER HAS TO PLAY***/
socket.on('play', function(msg){
      timeToPlay(msg.cards);
});

/*** USER HAS TO ANNOUNCE***/
socket.on('announce', function(msg){
      timeToAnnounce(msg.winningAnnounce);
});

// ==============================================================
// ================== ACTION FROM ANOTHER USER ===================
// ==============================================================
/*** ANOTHER USER SAID 'BELOTE' ***/
socket.on('belote', function(msg){
  var elem = $('<span>').addClass('belote').text( (msg.rebelote?'re':'')+ 'belote!');
  $('#'+ places[msg.name]).append(elem);
  setTimeout(function(){
    elem.remove();
  },2000);
});

/*** ANOTHER USER ANNOUNCED ***/
socket.on('announced', function(msg){
  $('#'+ places[msg.name] + ' .announce').text(' ' + (msg.value==0?'Pass':msg.value + msg.color));
  if (msg.winningAnnounce.value == 0){
    //nothing
  } else if (places[msg.winningAnnounce.playerName] == 'topPlayer' || places[msg.winningAnnounce.playerName] == 'bottomPlayer'){
    $('#bottomPlayer button').remove();
  } else {
    if ($('#bottomPlayer button').length == 0){
      var coincheButton = $('<button>').attr('onClick', 'coinche()').text('coinche');
      $('#bottomPlayer').append(coincheButton);
    }
  }
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
/*** ANOTHER USER COINCHED ***/
socket.on('coinche', function(msg){
  $('#'+ places[msg.name] + ' .announce').text('Coinched!');
  if(!$('#announceBoard').hasClass('hidden')) $('#announceBoard').addClass('hidden');
});

// ==============================================================
// ================== ACTION FROM SYSTEM ===================
// ==============================================================
// <<<<<<<<<<<< Manage game initialization >>>>>>>>>>>>>>
socket.on('initialize_game', function(msg){
  var myIndex = msg.players.indexOf(pseudo);
  for (var i = 0; i <msg.players.length; i++) {
    var playername = msg.players[(i+myIndex)%msg.players.length];
    places[playername]=positions[i];
    $('#'+ places[playername] + ' .playerName').text(playername)
  };
  dealer = msg.dealer;
  $('#' + places[msg.dealer]).append($('<span>').text('D').addClass('dealer'));
  $('<button>').text('Leave Game').attr('id','leaveGameButton').attr('onClick','leaveGame();').appendTo('#usersArea');
});

// <<<<<<<<<<<< GIVES THE USER HIS CARDS >>>>>>>>>>>>>>
socket.on('distribution', function(msg){
  distribute(msg.cards);
  $('#' + places[dealer] + ' .dealer').remove();
  dealer = msg.dealer;
  $('#' + places[msg.dealer]).append($('<span>').text('D').addClass('dealer'));
});

// <<<<<<<<<<<< INFORM USER OF THE TRUMPS >>>>>>>>>>>>>>
socket.on('chosen_trumps', function(msg){
  if (msg.value == 0){
    $('#playerCards').children().each(function(index, element){
        if($(this).is('img')){
          $(this).remove();
        }
    });
  } else {
    displayMsg('system',' Chosen trumps: ' + msg.color);
    $('#currentAnnounce').text(msg.value + ' ' + displayCardColor(msg.color) + (msg.coinche?' coinched': ''));
  }
  for (pName in places){
    $('#'+ places[pName] + ' .announce').text('');
  }
  $('#bottomPlayer button').remove();
});

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
// <<<<<<<<<<<< INFORM USER OF THE TRUMPS >>>>>>>>>>>>>>
socket.on('display_current_trick', function(msg){
  var cards = msg.cards;
  console.log(msg);
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
// <<<<<<<<<<<< Manage end of jetee >>>>>>>>>>>>>>
socket.on('end_jetee', function(msg){
  displayMsg('system',msg.message);
  updateScores(msg.scores);
  $('#currentAnnounce').text('');
});
// <<<<<<<<<<<< display the scores >>>>>>>>>>>>>>
socket.on('scores', function(msg){
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
// <<<<<<<<<<<< Leave the current game >>>>>>>>>>>>>>
socket.on('leave_game', function(msg){
  gameAbort(msg.name);
});

function gameAbort(){
  //delete cards
  $('#playerCards img').remove();
  //delete current announce
  $('#currentAnnounce').text('');
  //delete dealer button
  $('.dealer').remove();
  //delete leave button
  $('#leaveGameButton').remove();
  //delete scores
  $('.score').text('0');//todo : not first col
  //delete names
  //delete announces
  //delete current Trick
  //delete coinche button
  for (pName in places){
    var place = places[pName];
    $('#'+ place + ' .playerName').text('');
    $('#'+ place + ' .announce').text('');
    $('#'+ place + ' img').remove();
    $('#'+ place + ' button').remove();
  }
  //hide announce board
  if (!$('#announceBoard').hasClass('hidden')) $('#announceBoard').addClass('hidden');
}

function leaveGame(){
  if (confirm('Are you sure you wanna leave this game? This will kick everyone...')){
    socket.emit('leave_game',{msg:''});
    $('#leaveGameButton').remove();
  }
};
// <<<<<<<<<<<< change a user status >>>>>>>>>>>>>>
socket.on('user_status', function(msg){
  updateStatus(msg.user.name, msg.user.status);
})

function updateStatus(name, status){
  console.log('status for ' + name + ' is '+ status);
  var elem = $('#userList li').filter(function(){ return $(this).text() === name});
  if (!elem) return 0;
  switch (status){
    case 'available':
      elem.append($('<input />', { type: 'checkbox', value: name}));
    break;
    case 'hosting':
    case 'pending_invite':
    case 'in_game':
      $('#userList li').filter(function(){ return $(this).text() === name}).html(name);
    break;
    default:
      alert(status);
  }
}

// ==============================================================
// ================== ACTION FROM SYSTEM ===================
// ==============================================================

function displayMsg(type, msg){
var elem = $('<li>').text(msg).addClass(type);
  $('#messages').append(elem);
  var elems = $('#messages li:not(:last-child)');
  elems.each(function(index, element){
    console.log($(element).css('bottom'));
    var prevBot = $(element).css('bottom');
    prevBot = parseInt(prevBot.substr(0, prevBot.length - 2));
    $(element).css({bottom: prevBot + 35});
  })
  setTimeout(function(){
    elem.hide(1000, function(){
      elem.remove();
    });
  }, Math.max(5000,elem.text().length*150));
}