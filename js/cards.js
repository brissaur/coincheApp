var testcards = ['9H','8S','JC','10H','JH','QH','KH','AH'];
var greatestAnnounce = 0;
var SHIFTLEFTVALUE = 30;

// <<<<<<<<<<<< Distribute cards >>>>>>>>>>>>>>
var distribute = function(cards){
  var zindex=10;
  var shiftLeft=150;
  var playerCards = $('#playerCards');
  for (var i = 0; i < cards.length; i++) {
    var c = document.createElement('img');
    c.src='/images/cards/'+cards[i]+'.png';
    c.className = "card cardToBePlayed";
    c.style['z-index']=zindex;
    c.style.left=shiftLeft;
    c.id=cards[i];
    $(c).hover(function(){
      $(this).css({cursor: 'pointer'});
    }, function(){
      $(this).css({cursor: 'default'});
    })
    zindex*=10;
    shiftLeft+=SHIFTLEFTVALUE;
    playerCards.append(c);
  }
}

// <<<<<<<<<<<< REARRANGE HAND WHEN ONE IS PLAYED >>>>>>>>>>>>>>
var shiftCards = function(){
  var shiftLeft=150;
  $('#playerCards img').each(function(index, elem){
    console.log(elem);
    $(elem).offset({'left': shiftLeft});
    shiftLeft+=SHIFTLEFTVALUE;
  })
}

// <<<<<<<<<<<< USER MUST ANNOUNCE >>>>>>>>>>>>>>
var timeToAnnounce = function(winningAnnounce){
  greatestAnnounce = winningAnnounce;
  $('.announceValue').each(function(index, element){
      if(parseInt($(element).attr('value'))<=parseInt(winningAnnounce.value)) $(element).addClass('hidden');
  });
  if (winningAnnounce.value == 0 || places[winningAnnounce.playerName]=='topPlayer') $(".validation button[value='Coinche']").addClass('hidden');
  $('#bottomPlayer button').remove();
  $('#announceBoard').removeClass('hidden');
}
function manageAnnounceButton(elem){
  $('.'+$(elem).attr('class')).removeClass('selected');
  $(elem).addClass('selected');
}

function sendAnnounce(elem){
  var announceType = $(elem).attr('value');
  if (announceType == 'Announce'){
    var value =  $('.announceValue.selected').attr('value');
    var color =  $('.announceColor.selected').attr('value');
    if (value && color){
      socket.emit('announce', {value:value, color:color});
      $('#announceBoard').addClass('hidden');
      greatestAnnounce = 0;
    } else {
      return 0;
    }
  } else if (announceType == 'Pass'){
      socket.emit('announce', {value:0, color:''});
      $('#announceBoard').addClass('hidden');
      greatestAnnounce = 0;
  } else if (announceType == 'Coinche'){
    if (greatestAnnounce != 0){
        coinche();
        $('#announceBoard').addClass('hidden');
    } else {
      return 0;
    }
  } else {
    
  }
  $('.announceValue').removeClass('selected');
  $('.announceColor').removeClass('selected');
  $('.announceValue').removeClass('hidden');
  $(".validation button[value='Coinche']").removeClass('hidden');
}

// <<<<<<<<<<<< USER COINCHE >>>>>>>>>>>>>>
function coinche(){
  socket.emit('coinche');
  $('#bottomPlayer button').remove();
  greatestAnnounce = 0;
}
// <<<<<<<<<<<< USER MUST PLAY >>>>>>>>>>>>>>
var timeToPlay = function(cards){
  cards.forEach(function(card){
    $('#'+card)
      .css('border','thin solid red')

      .on('click', function (event){
        var isItATen = this.src.substr(-7,2)=='10';
        var firstIndex = isItATen? -7:-6;
        var length = isItATen? 3:2;
        var targetCard =this.src.substr(firstIndex,length);

        socket.emit('play', {card: targetCard});
        $('#playerCards').children().css('border','').unbind('click');
        $('#bottomPlayer .announce').text('');
        $(this).remove();
        shiftCards();
    });
  });
  $('#bottomPlayer .announce').text('Your turn');
}