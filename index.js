const { HLTV } = require('hltv')
var CronJob = require('cron').CronJob;
var bodyParser = require("body-parser");

const initDb = require("./mongodbUtil").initDb;
const getDb = require("./mongodbUtil").getDb;

const myHLTV = HLTV.createInstance({})

const PORT = process.env.PORT || 5000

var test

const express = require("express");
var app = express();

initDb(function (err) {
  app.listen(PORT, function (err) {
    if (err) {
      throw err; //
    }
    console.log("API Up and running on port " + PORT);
  });

  var job = new CronJob('*/5 * * * * *', function() {
    const db = getDb().db();
    db.collectio('match_maps').find({ stats: null }).limit(1).toArray(function(err, result){
      if (err) {
        console.error(err)
        return
      }
      result.forEach(function(match_map){
        console.log(match_map.id)
        HLTV.getMatchMapStats({id: match_map.id}).then((map_stat) => {
          if (map_stat === null) return;
          db.collection('match_maps').updateOne({_id: match_map._id}, {$set: {"stats": map_stat}}, function(err, res) {
            if (err) {
              console.error("error when crawl map stats", match_map.id, err)
              return
            }
            console.log("Number of documents updated: 1");
          });
        })
      })
    });
  }, null, false);
  job.start()
});

app.get("/crawl", (req, res, next) => {
  // HLTV.getTeamStats({id: 6665}).then(teamStats => {
  // res.json(teamStats);
  // })
  const db = getDb().db();
  HLTV.getMatchesStats({startDate: req.start+"&rankingFilter=Top30", endDate: req.end}).then((matches) => {
    if (matches.length > 0) {
      matches.forEach(function(item){
        var exist = false;
        db.collection('match_maps').findOne({id: item.id}, function(err, result){
          if (result !== null) exist = true;
        });
        if (exist) return;
        db.collection('match_maps').insert(item, function(err, res) {
          if (err) {
            console.error(err)
            return
          }
        });
      })
    }
    res.json(matches);
  })
});


