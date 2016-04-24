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

var TIMEUNIT = 1000;
var WAITINGTIME = 2 * TIMEUNIT;
var preventEvent = false;

// ==============================================================
// ================== INITIAL SCRIPTS ===============================
// ==============================================================
// <<<<<<<<<<<< GET LIST CONNECTED USER >>>>>>>>>>>>>>
$.get('/connectedUsers',function(data){
    data.forEach(function(user){
      var elem = $('<li>').text(user.name);
      updateStatusElem(elem,user.status);
      // if (user.status == 'available') elem.append($('<input />', { type: 'checkbox', value: user.name}));
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
        
        if (!$('#messageInput').is((":focus"))) e.preventDefault();
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
  var message = '';
  var i = 0;
  // while (){}
  if (msg.message.length > 50){
    message = msg.message.slice(0,50) + '<br />' + msg.message.slice(50, msg.message.length);
  } else {
    message = msg.message;
  }
  displayMsg('chat', msg.name + ': ' +message);

});

function strSplice(start, length){
  
}
// ==============================================================
// ================== CONNECTION ===============================
// ==============================================================
// <<<<<<<<<<<< Manage new connection >>>>>>>>>>>>>>
socket.on('connection', function(msg){
  displayMsg('system', msg.user.name + ' is connected.');

  var nbChildren = $('#userList').children().length;
  var elemToBeInserted = $('<li>').text(msg.user.name);
  // if (msg.user.status == 'available') elemToBeInserted.append($('<input />', { type: 'checkbox', value: msg.user.name}));
  updateStatusElem(elemToBeInserted, msg.user.status);
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

function newGame(){
  socket.emit('new_game',{message:''});
  //enter player as bottomPlayer
  $('#bottomPlayer .playerName').text(pseudo);
  $('#newGameButton').addClass('hidden');
  $('#inviteButton').removeClass('hidden');
  $('#playButton').removeClass('hidden');
  $('#leaveRoomButton').removeClass('hidden');
};

socket.on('joined_room', function(msg){
  console.log({type:'join', msg: msg});
  displayMsg('system',msg.name + ' joined the room.');
  places[msg.name]=positions[msg.place];
  $('#'+ places[msg.name] + ' .playerName').text(msg.name);
  $('<button>').attr('onClick', 'swapPlace('+"'"+msg.name+"'"+');').text('swap place').appendTo($('#'+ places[msg.name]));

});
socket.on('left_room', function(msg){
  displayMsg('system',msg.name + ' left the room.');
  emptyPlace(places[msg.name]);
});
socket.on('room_cancel', function(msg){
  displayMsg('system','Host left the room. You were removed from the room.');
  positions.forEach(function(pos){
    emptyPlace(pos);
  })
  $('#leaveRoomButton').addClass('hidden');
  $('#newGameButton').removeClass('hidden');
});

socket.on('present_players', function(msg){
  debugger;
  console.log({type:'present_players', msg: msg});
  var myIndex = msg.players.indexOf(pseudo);
  for (var i = 0; i <msg.players.length; i++) {
    var playername = msg.players[i];
    places[playername]=positions[(i-myIndex+4)%4];
    $('#'+ places[playername] + ' .playerName').text(playername)
  };
});

socket.on('game_invitation', function(msg){// name, 
  $('#inviteBoard').removeClass('hidden');
  $('#newGameBoard').addClass('hidden');
  $('#inviteBoard p').text(msg.name + ' invited you for a game.');
});

socket.on('game_invitation_cancelled', function(msg){
  $('#inviteBoard').addClass('hidden');
  displayMsg('system',msg.name + ' declined the invitation.');
});
socket.on('invitation_timeout', function(msg){
  $('#inviteBoard').addClass('hidden');
  $('#newGameBoard').removeClass('hidden');

  // displayMsg('system',msg.name + ' declined the invitation.');
});
socket.on('game_ready_to_start',function(msg){
  $('#playButton').removeClass('playNotAvailable');
});
socket.on('game_not_ready_to_start',function(msg){
  $('#playButton').addClass('playNotAvailable');
});

function invitePlayers(){
  var players = [];
  // $('#inviteList :checkbox:checked').each(function(index, element){//TODO pb si aucun enfant;
  $('.invited').each(function(index, element){//TODO pb si aucun enfant;
    players.push($(this).text());
    console.log($(this).text());
  });
  if(players.length>0) {
    socket.emit('game_invitation', {players: players});
    $('#inviteList li').remove();
    $('#inviteFriends').addClass('hidden');
  }
  $('#newGameBoard').removeClass('hidden');
}
function abortFriendsInvitation(){
  $('#inviteList li').remove();
  $('#newGameBoard').removeClass('hidden');
  $('#inviteFriends').addClass('hidden');
}

function acceptInvite(){
  socket.emit('game_invitation_accepted',{msg:''});
  $('#bottomPlayer .playerName').text(pseudo);
  $('#inviteBoard').addClass('hidden');
  $('#leaveRoomButton').removeClass('hidden');
  $('#newGameBoard').removeClass('hidden');
  $('#newGameButton').addClass('hidden');
}
function refuseInvite(){
  socket.emit('game_invitation_refused',{msg:''});
  $('#inviteBoard').addClass('hidden');
  $('#newGameBoard').removeClass('hidden');
}

function inviteFriends(){
  $('#inviteFriends').removeClass('hidden');
  $('#newGameBoard').addClass('hidden');
  $.get('/connectedUsers',function(data){
    data.forEach(function(user){
      if(user.status == 'available'){
        var elem = $('<li>').text(user.name).addClass('invitable')
        .on('click', function(){
          if (!$(this).hasClass('invited')){
            $(this).css('backgroundColor', 'darkblue');
            // $(this).css('color', 'blue');
            $(this).addClass('invited');
          } else {
            $(this).css('backgroundColor', 'blue');
            $(this).removeClass('invited');
          }
        }); //append($('<input />', { type: 'checkbox', value: user.name}));
        // var elem = $('<li>').text(user.name).append($('<input />', { type: 'checkbox', value: user.name}));
        $('#inviteList').append(elem);
      }
    });
    if ($('#inviteList li').length == 0) $('<li>').text('No friends can be invited').appendTo($('#inviteList'));
  });
}

$('.invitable').on('click', function(){
  alert('!!!');
})

function leaveRoom(){
  $('#leaveRoomButton').addClass('hidden');
  socket.emit('leave_room',{msg:''});
  positions.forEach(function(pos){
    emptyPlace(pos);
  })
  $('#newGameButton').removeClass('hidden');
  var elem = $('#inviteButton');
  if(!elem.hasClass('hidden')) elem.addClass('hidden');
  var elem = $('#playButton');
  if(!elem.hasClass('hidden')) elem.addClass('hidden');
  if(!elem.hasClass('playNotAvailable')) elem.addClass('playNotAvailable');
}

function swapPlace(name){
  socket.emit('swap_place', {name:name});
  displayMsg('system','Swapping with '+name+'...');
}

socket.on('they_swap', function(msg){
  var place = places[msg.p1];
  places[msg.p1] = places[msg.p2];
  places[msg.p2] = place;

  thisPlaceIsNowOccupiedByThisPlayer(places[msg.p1], msg.p1);
  thisPlaceIsNowOccupiedByThisPlayer(places[msg.p2], msg.p2);
});

socket.on('you_swap', function(msg){
  var shift = 4 - positions.indexOf(places[msg.name]);
  // var place = places[msg.name];
  for(pName in places){
    emptyPlace(places[pName]);
  }

  places[msg.name] = 'bottomPlayer';
  for(pName in places){
    var pIndex = positions.indexOf(places[pName]);
    places[pName] = positions[(pIndex+shift)%4];
  }
  for(pName in places){
    thisPlaceIsNowOccupiedByThisPlayer(places[pName], pName);
  }
});

function thisPlaceIsNowOccupiedByThisPlayer(place, name){
  $('#' + place + ' .playerName').text(name);
  // $('#' + place + ' button').attr('onclick','swapPlace('+"'"+name+"'"+');');
  $('#' + place + ' button').remove();
  $('<button>').attr('onClick', 'swapPlace('+"'"+name+"'"+');').text('swap place').appendTo($('#'+ place));
}
function emptyPlace(place){
  $('#' + place + ' .playerName').text('');
  $('#' + place + ' button').remove();
}

function launchGame(){
  if (!$('#playButton').hasClass('playNotAvailable')){
    socket.emit('start_game',{});
  }
}
// ==============================================================
// ================== ACTION FROM THIS USER ===================
// ==============================================================
/*** USER HAS TO PLAY***/
socket.on('play', function(msg){
  if (preventEvent){
    setTimeout(function() {
      timeToPlay(msg.cards);
    }, WAITINGTIME);
  } else {
    preventEvent = false;
    timeToPlay(msg.cards);
  }
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

  var c = document.createElement('img');
    c.src='/images/cards/'+msg.card+'.png';
    c.className = "card";
    targetCard.appendChild(c);
});
/*** ANOTHER USER COINCHED ***/
socket.on('coinche', function(msg){
  setTimeout(function() {
    $('#'+ places[msg.name] + ' .announce').text('Coinched!');
    if(!$('#announceBoard').hasClass('hidden')) $('#announceBoard').addClass('hidden');
  }, WAITINGTIME);
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

  $('#newGameBoard').addClass('hidden');
  $('#newGameButton').removeClass('hidden');

  $('#leaveRoomButton').addClass('hidden');
  if (!$('#playButton').hasClass('hidden')) $('#playButton').addClass('hidden');
  if (!$('#inviteButton').hasClass('hidden')) $('#inviteButton').addClass('hidden');
  for (pName in places){
    $('#' + places[pName] + ' button').remove();
  }

});

// <<<<<<<<<<<< GIVES THE USER HIS CARDS >>>>>>>>>>>>>>
socket.on('distribution', function(msg){
  setTimeout(function() {
    distribute(msg.cards);
    $('#' + places[dealer] + ' .dealer').remove();
    dealer = msg.dealer;
    $('#' + places[msg.dealer]).append($('<span>').text('D').addClass('dealer'));
  }, (preventEvent?WAITINGTIME:0));
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
  preventEvent = true;
  setTimeout(function() {
    for(divs in places){
      $('#' + places[divs] + ' img').remove();
    }
    preventEvent = false;
  }, WAITINGTIME);
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
  //display newGameBoard
  $('#newGameBoard').removeClass('hidden');
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
  var elem = $('#userList li').filter(function(){ return $(this).text() === name});
  updateStatusElem(elem, status);
}

function updateStatusElem(elem, status){
  if (!elem) return 0;
  switch (status){
    case 'available':
      // elem.append($('<input />', { type: 'checkbox', value: name}));
      elem.css('color','green');
    break;
    case 'hosting':
    case 'pending_invite':
      elem.css('color','orange');

    break;
    case 'in_game':
      elem.css('color','red');
      // $('#userList li').filter(function(){ return $(this).text() === name}).html(name);
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