const mapSlugToName = function(){
  var slugMap = {
    'trn' : 'de_train',
    'cbl' : 'de_cobblestone',
    'inf': 'de_inferno',
    'cch': 'de_cache',
    'mrg': 'de_mirage',
    'ovp': 'de_overpass',
    'd2' : 'de_dust2',
    'nuke' : 'de_nuke',
    'tcn' : 'de_tuscan',
    'vertigo' : 'de_vertigo',
  }
  return function(slug){
    return slugMap[slug]
  }
}()

function dis(dateObj){
  return dateObj.toISOString().slice(0,10)
}

function threeMonthsAgo(unix) {
  var c = new Date(unix)
  var o = new Date(c.setMonth(c.getMonth()-3))
  return dis(o)
}

function yesterday(unix) {
  var c = new Date(unix)
  var o = new Date(c.setDate(c.getDate()-1))
  return dis(o)
}

module.exports = {
  mapSlugToName,
  dis,
  threeMonthsAgo,
  yesterday,
};
