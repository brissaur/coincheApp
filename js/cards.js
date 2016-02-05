var testcards = ['9H','8S','JC','10H','JH','QH','KH','AH'];
var greatestAnnounce = 0;
var distribute = function(cards){
  // assert(cards.length==8);
  var zindex=10;
  var shiftLeft=90;
  var playerCards = $('#playerCards');
  // assert(playerCards);
  for (var i = 0; i < cards.length; i++) {
    // console.log('card'+i);
    var c = document.createElement('img');
    c.src='/images/cards/'+cards[i]+'.png';
    c.className = "card cardToBePlayed";
    c.style['z-index']=zindex;
    c.style.left=shiftLeft;//('left', shiftLeft+100);
    c.id=cards[i];
    zindex*=10;
    shiftLeft-=30;
    playerCards.append(c);
  }
}
// distribute(testcards);
var timeToAnnounce = function(winningAnnounce){
  //display area and wait input
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

        function coinche(){
          socket.emit('coinche');//todo probleme reseaumessages croisés -> mettre la derniere announce?
          $('#bottomPlayer button').remove();
          greatestAnnounce = 0;
        }
var timeToPlay = function(cards){
  // $('#messages').append($('<li>').text('I can play...' + cards));
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
        this.parentNode.removeChild(this);
    });
  });
  $('#bottomPlayer .announce').text('Your turn');
}



// distribute(testcards); 

