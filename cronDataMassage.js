require('dotenv').config();
const getHLTV = require('./hltvWrapper').getHLTV;
const changeProxy = require('./hltvWrapper').proxyManager.changeProxy;
const errorHandler = require('./mongodbUtil').errorHandler;
const initDb = require("./mongodbUtil").initDb;
const getDb = require("./mongodbUtil").getDb;
const assert = require("assert");
const mapSlugToName = require("./utils").mapSlugToName
const dis = require("./utils").dis
const threeMonthsAgo = require("./utils").threeMonthsAgo
const yesterday = require("./utils").yesterday
var CronJob = require('cron').CronJob;
var Honeybadger = require('honeybadger').configure({
    apiKey: process.env.HB_API_KEY
});

const TOP_50 = "Top50"


var aWinRound = (roundHistory, aId, bId) => {
  var ct_win = {
    "ct_win": 1,
    "bomb_defused":1,
    "stopwatch": 1,
  }
  var t_win = {
    "t_win": 1,
    "bomb_exploded" : 1,
  }
  if (roundHistory.outcome in ct_win && roundHistory.ctTeam == aId) return true 
  if (roundHistory.outcome in ct_win && roundHistory.ctTeam !== aId) return false 
  if (roundHistory.outcome in t_win && roundHistory.tTeam == aId) return true 
  if (roundHistory.outcome in t_win && roundHistory.tTeam !== aId) return false 
}

var _createDataPoint = async function() {
  const db = getDb().db()
  const hltv = getHLTV("");

  var match = await db.collection("matches").findOne({$and: [{stats:{$exists:true}},{players_stats:{$exists:true}},{players_extra_stats:{$exists:true}},{players_extra_stats_per_map:{$exists:true}},{teams_stats:{$exists:true}},{teams_extraStats:{$exists:true}},{teams_extraStatsPerMap:{$exists:true}}, {datated: null}]}).catch(errorHandler("finding 1 match with dateted = null"))
  console.log(match.match.id)

  var startIndex = 0
  var isNotBo1 = false
  while (match.match.maps[startIndex].statsId == null) {
    startIndex++
  }

  if (startIndex+1 < match.match.maps.length && match.match.maps[startIndex+1].statsId !== null && match.match.format.split(" ")[2] !== '1')
    isNotBo1 = true
  var map1_stats = await db.collection("match_maps").findOne({"id": match.match.maps[startIndex].statsId}).catch(errorHandler("finding 1 map with id = " + match.match.maps[startIndex].statsId))

  var m1_result =  match.match.maps[startIndex].result.split("(")[0].split(":")
  var m2_result;
  if (isNotBo1)
    m2_result =  match.match.maps[startIndex+1].result.split("(")[0].split(":")

  var createPastSeries = async (matchIds) => {
    var pastSeries = []
    for (mid of matchIds) {
      var id = mid.id
      var pastMatch = await db.collection("matches").findOne({$and: [{stats:{$exists:true}},{players_stats:{$exists:true}},{players_extra_stats:{$exists:true}},{players_extra_stats_per_map:{$exists:true}},{teams_stats:{$exists:true}},{teams_extraStats:{$exists:true}},{teams_extraStatsPerMap:{$exists:true}}, {"match.id": id}]}).catch(errorHandler("finding 1 full data match with id = " + id))
      var pastStats = pastMatch && pastMatch.stats;
      
      if (pastMatch && pastMatch.stats == true) {
        pastStats = await db.collection("match_maps").findOne({"id": pastMatch.match.maps[0].id}).catch(errorHandler("finding 1 map with id = " + pastMatch.match.maps[0].id))
      }
      var team1 = pastMatch && pastMatch.match.team1
      var team2 = pastMatch && pastMatch.match.team2
      if (pastMatch == null) {
        pastMatch = await hltv.getMatch({id: id})
        if (pastMatch.additionalInfo.indexOf("forfeit") !== -1) continue
        if (pastMatch.additionalInfo.indexOf("forfiet") !== -1) continue
        if (pastMatch.additionalInfo.indexOf("advantage") !== -1) continue
        if (pastMatch.statsId == undefined) {
          console.log(id)
          continue
        }
        if (pastMatch.format.split(" ")[2] == '1') {
          pastStats = await hltv.getMatchMapStats({id: pastMatch.maps[0].statsId})
        } else{
          pastStats = await hltv.getMatchStats({id: pastMatch.statsId})
        }
        team1 = pastMatch.team1
        team2 = pastMatch.team2
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      pastSeries.push({
        team1: team1,
        team2: team2,
        stats: pastStats,
      })
    }

    return pastSeries
  }

  var findH2H = async (aId, bId, cmId) => {
    var h2hs = []
    var avsB = await db.collection("matches").find({ $and: [ { "match.match.team1.id": aId },{ "match.match.team2.id": bId }]}).toArray().catch(errorHandler("finding matches with team1.id and team2.id = " + aId + ", " + bId))
    var bvsA = await db.collection("matches").find({ $and: [ { "match.match.team1.id": bId },{ "match.match.team2.id": aId }]}).toArray().catch(errorHandler("finding matches with team1.id and team2.id = " + aId + ", " + bId))

    for (m of avsB) {
      if (m._id === cmId) continue
      h2hs.push(m.stats)
    }
    for (m of bvsA) {
      if (m._id === cmId) continue
      h2hs.push(m.stats)
    }

    return h2hs
  }

  var findH2HPerMap = async (aId, bId, map, cmId) => {
    var h2hs = []
    var avsB = await db.collection("match_maps").find({ $and: [ { "team1.id": aId },{ "team2.id": bId }, {"map": map}]}).toArray().catch(errorHandler("finding maps with team1.id and team2.id = " + aId + ", " + bId))
    var bvsA = await db.collection("match_maps").find({ $and: [ { "team1.id": bId },{ "team2.id": aId }, {"map": map}]}).toArray().catch(errorHandler("finding maps with team1.id and team2.id = " + aId + ", " + bId))

    for (m of avsB) {
      if (m.matchPageID === cmId) continue
      h2hs.push(m.stats)
    }
    for (m of bvsA) {
      if (m.matchPageID === cmId) continue
      h2hs.push(m.stats)
    }

    return h2hs
  }

  var am_minus_bm = 0
  var total_map = 1
  if (match.stats.team1) {
    am_minus_bm= match.stats.team1.score-match.stats.team2.score
    total_map= match.stats.team1.score+match.stats.team2.score
  }
  var winnerId = 0 
  if (match.match.winnerTeam !== null) {
    winnerId = match.match.winnerTeam.id
  }
  var labels_m1 = {
    a_winner: Number(m1_result[0])>Number(m1_result[1]),
    a_series_winner: winnerId == match.match.team1.id,
    total_round: Number(m1_result[0])+Number(m1_result[1]),
    ar_minus_br: Number(m1_result[0]) - Number(m1_result[1]),
    am_minus_bm: am_minus_bm,
    a_win_first_pistol: aWinRound(map1_stats.stats.roundHistory[0], match.match.team1.id, match.match.team2.id),
    a_win_second_pistol: aWinRound(map1_stats.stats.roundHistory[15], match.match.team1.id, match.match.team2.id),
    total_map: total_map,
  }

  var labels_m2 = {}
  if (isNotBo1)
    labels_m2 = {
      a_winner: Number(m2_result[0])>Number(m2_result[1]),
      a_series_winner: winnerId == match.match.team1.id,
      total_round: Number(m2_result[0])+Number(m2_result[1]),
      ar_minus_br: Number(m2_result[0]) - Number(m2_result[1]),
      am_minus_bm: am_minus_bm,
      a_win_first_pistol: aWinRound(map1_stats.stats.roundHistory[0], match.match.team1.id, match.match.team2.id),
      a_win_second_pistol: aWinRound(map1_stats.stats.roundHistory[15], match.match.team1.id, match.match.team2.id),
      total_map: total_map,
    }

  var h2h = await findH2H(match.match.team1.id, match.match.team2.id, match._id)
  var h2h_m1 = await findH2HPerMap(match.match.team1.id, match.match.team2.id, match.match.maps[startIndex].name, match.id)
  var h2h_m2;
  if (isNotBo1)
    h2h_m2 = await findH2HPerMap(match.match.team1.id, match.match.team2.id, match.match.maps[startIndex+1].name, match.id)
  var a_pastSeries = await createPastSeries(match.match.pastSeries.team1)
  var b_pastSeries = await createPastSeries(match.match.pastSeries.team2)


  var first_map_data_point = {
    rank_a: match.match.team1.rank,
    rank_b: match.match.team2.rank,
    map: match.match.maps[startIndex].name,
    format: match.match.format,
    additional_info: match.match.additionalInfo,
    a_past_series: a_pastSeries,
    b_past_series: b_pastSeries,
    players_stats: match.players_stats,
    players_extra_stats: match.players_extra_stats,
    players_extra_stats_per_map: match.players_extra_stats_per_map,
    teams_stats: match.teams_stats,
    teams_extra_stats: match.teams_extraStats,
    teams_extra_stats_per_map: match.teams_extraStatsPerMap,
    head_to_heads: h2h,
    head_to_heads_per_map: h2h_m1,
  }

  var second_map_data_point = {}
  if (isNotBo1)
    second_map_data_point = {
      stats_m1: map1_stats,
      rank_a: match.match.team1.rank,
      rank_b: match.match.team2.rank,
      map: match.match.maps[startIndex +1].name,
      format: match.match.format,
      additional_info: match.match.additionalInfo,
      a_past_series: a_pastSeries,
      b_past_series: b_pastSeries,
      players_stats: match.players_stats,
      players_extra_stats: match.players_extra_stats,
      players_extra_stats_per_map: match.players_extra_stats_per_map,
      teams_stats: match.teams_stats,
      teams_extra_stats: match.teams_extraStats,
      teams_extra_stats_per_map: match.teams_extraStatsPerMap,
      head_to_heads: h2h,
      head_to_heads_per_map: h2h_m2,
    }

  db.collection("data_m1").insertOne({features: first_map_data_point, label: labels_m1}).catch(errorHandler("inserting 1 datapoint map 1"))
  if (isNotBo1)
    db.collection("data_m2").insertOne({features: second_map_data_point, label: labels_m2}).catch(errorHandler("inserting 1 datapoint map 2"))
  db.collection("matches").updateOne({_id: match._id}, {$set: {"datated": true}}).catch(errorHandler("update 1 match datated to true"))
}

var jobManager = function(n){
  var jobIndex = 0
  console.log("init busy")
  var busy = false
  const jobList = [

    {
      name: 'createDataPoint',
      handler: _createDataPoint,
    },
  ]

  return {
    execute: async function(){
      if (busy) return
      console.log("Worker %s starting cron job %s", n, jobList[jobIndex].name)
      busy = true
      await jobList[jobIndex].handler().catch(errorHandler(jobIndex))
      busy = false;

      if (jobIndex == jobList.length-1)
        jobIndex = 0;
      else
        jobIndex++;
    },
    errorHandler: (jobIndex) => async (err) => {
      console.error(err)
      Honeybadger.notify(err);
    },
  }
}("DataCreator")

async function startCronScheduler(){
  await initDb(function (err) {
    if (err != null) {
      console.error(err)
    }
  });
  var job = new CronJob(process.env.CRON_CREATE_DATA_FORMAT, jobManager.execute, null, false);
  job.start()
}

module.exports = {
    startCronScheduler
};
