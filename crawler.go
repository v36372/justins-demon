package main

import (
	"encoding/json"
	"fmt"
	"justins-demon/infra"
	"justins-demon/models"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gocolly/colly"
	_ "github.com/lib/pq"
	"github.com/robfig/cron"
)

const (
	matchLink  = "https://www.hltv.org/events/archive?startDate=2018-01-01&endDate=2019-07-28&offset=%d"
	teamLink   = "https://www.hltv.org/stats/teams?startDate=2019-03-01&endDate=2019-09-01&rankingFilter=Top50"
	oddsLink   = "https://www.hltv.org/betting/money"
	vpLink     = "http://www.vpgame.com/prediction/api/inplay/schedules?category=csgo&type=fixed"
	hltvDomain = "https://hltv.org"
)

// func fix() {
// 	events := []models.Event{}

// 	infra.PostgreSql.Model(models.Event{}).Find(&events)

// 	var wg sync.WaitGroup

// 	for i, e := range events {
// 		fmt.Println(i)
// 		crawlPastMatch(fmt.Sprintf("https://www.hltv.org/results?event=%s", e.Id), &wg, e.Id)
// 	}
// }

type VpTeam struct {
	Name        string `json:"name"`
	SteamTeamId int    `json:"steam_team_id"`
}

type VpTeams struct {
	Left  VpTeam `json:"left"`
	Right VpTeam `json:"right"`
}

type Option struct {
	Id              int    `json:"id"`
	PartnerOptionId int    `json:"partner_option_id"`
	OptionName      string `json:"option_name"`
	Odds            string `json:"odds"`
}

type VpPrediction struct {
	Id         int      `json:"id"`
	ScheduleId int      `json:"schedule_id"`
	ModeName   string   `json:"mode_name"`
	ModeRemark string   `json:"mode_remark"`
	Handicap   string   `json:"handicap"`
	Options    []Option `json:"option"`
}

type VPgameMatch struct {
	ScheduleId   int            `json:"schedule_id"`
	VpScheduleId int            `json:"vp_schedule_id"`
	VpTeams      VpTeams        `json:"teams"`
	Predictions  []VpPrediction `json:"predictions"`
}

type VPgameAPIResult struct {
	Matches []VPgameMatch `json:"data"`
}

func crawlVP() {
	client := &http.Client{}
	req, _ := http.NewRequest("GET", vpLink, nil)

	resp, _ := client.Do(req)
	defer resp.Body.Close()
	var vpgameResult VPgameAPIResult
	json.NewDecoder(resp.Body).Decode(&vpgameResult)

	for _, match := range vpgameResult.Matches {
		var existedMatch models.MatchOdd
		infra.PostgreSql.Model(models.MatchOdd{}).
			Where("(a = ? and b = ?) or (a = ? and b = ?)", match.VpTeams.Left.Name, match.VpTeams.Right.Name, match.VpTeams.Right.Name, match.VpTeams.Left.Name).
			Order("created_at desc").
			Limit(1).
			Find(&existedMatch)
		if existedMatch.Id == 0 || existedMatch.Amount > 0 {
			continue
		}

		mlOddA, mlOddB := "", ""

		for _, p := range match.Predictions {
			if p.ModeName == "Match Winner" {
				mlOddA = p.Options[0].Odds
				mlOddB = p.Options[1].Odds
				break
			}
		}

		tmpA, _ := strconv.ParseFloat(mlOddA, 32)
		tmpB, _ := strconv.ParseFloat(mlOddB, 32)

		vpOddA := float32(tmpA)
		vpOddB := float32(tmpB)

		var kellyA, kellyB float32

		if existedMatch.A == match.VpTeams.Left.Name {
			kellyA, kellyB = calculateKelly(vpOddA, vpOddB, existedMatch.AverageA, existedMatch.AverageB)
		} else {
			kellyB, kellyA = calculateKelly(vpOddA, vpOddB, existedMatch.AverageB, existedMatch.AverageA)
		}

		var betAmount float32
		var playedOdd float32
		betAmount = kellyB / 400 // Quarter kelly
		playedOdd = vpOddB
		if kellyA > kellyB {
			existedMatch.BetOnA = true
			betAmount = kellyA / 400
			playedOdd = vpOddA
		}

		var balance models.Balance
		infra.PostgreSql.Model(models.Balance{}).Find(&balance)

		amount := balance.Total * betAmount
		balance.Total -= amount
		existedMatch.KellyA = kellyA
		existedMatch.KellyB = kellyB
		existedMatch.Amount = amount
		existedMatch.PlayedOdd = playedOdd

		infra.PostgreSql.Save(&balance)
		infra.PostgreSql.Save(&existedMatch)
	}
}

func calculateKelly(bookieOddA, bookieOddB, edgeOddA, edgeOddB float32) (float32, float32) {
	a := ((1/edgeOddA)*bookieOddA - 1) / (bookieOddA - 1)
	b := ((1/edgeOddB)*bookieOddB - 1) / (bookieOddB - 1)

	return a, b
}

type HLTVPlayerStats struct {
	PlayerId int    `json:"playerId"`
	TeamId   int    `json:"teamId"`
	Rating   string `json:"rating"`
	Kpr      string `json:"kpr"`
	Dpr      string `json:"dpr"`
	Kast     string `json:"kast"`
	Impact   string `json:"impact"`
	Adr      string `json:"adr"`
}

func crawlComingMatch(link string) {
	c := colly.NewCollector()

	c.OnHTML(".mapholder", func(e *colly.HTMLElement) {
		currentmapname := e.ChildText(".played .map-name-holder .mapname")
		if currentmapname != "TBA" {
			// TODO: trigger AI
		}
	})
	comingMatch := models.ComingMatch{}

	defer func() {
		err := infra.PostgreSql.Create(&comingMatch).Error
		if err != nil {
			fmt.Println(err)
		}
	}()

	c.OnHTML("div.lineups-compare-container", func(e *colly.HTMLElement) {
		teamAStats := e.Attr("data-team1-players-data")
		teamBStats := e.Attr("data-team2-players-data")

		teamAStatsMap := map[string]HLTVPlayerStats{}
		teamBStatsMap := map[string]HLTVPlayerStats{}

		json.Unmarshal([]byte(teamAStats), &teamAStatsMap)
		json.Unmarshal([]byte(teamBStats), &teamBStatsMap)

		teamAStatsString := []string{}
		teamBStatsString := []string{}

		a, b := 0, 0

		for _, p := range teamAStatsMap {
			p.Kast = strings.Split(p.Kast, "%")[0]
			teamAStatsString = append(teamBStatsString, p.Adr, p.Dpr, p.Impact, p.Kast, p.Kpr, p.Rating)
			a = p.TeamId
		}

		for _, p := range teamBStatsMap {
			p.Kast = strings.Split(p.Kast, "%")[0]
			teamBStatsString = append(teamBStatsString, p.Adr, p.Dpr, p.Impact, p.Kast, p.Kpr, p.Rating)
			b = p.TeamId
		}

		comingMatch.Link = link
		comingMatch.A = a
		comingMatch.B = b
		comingMatch.APlayersStats = strings.Join(teamAStatsString, ",")
		comingMatch.BPlayersStats = strings.Join(teamBStatsString, ",")
	})

	c.OnHTML(".map-stats-infobox", func(e *colly.HTMLElement) {
		mapsCompare := []string{}
		e.ForEach(".map-stats-infobox-maps", func(n int, x *colly.HTMLElement) {
			mapName := x.ChildText("div.map-stats-infobox-mapname-container div div")
			aWr := x.ChildText("div.map-stats-infobox-stats div.map-stats-infobox-winpercentage  a")
			aP := x.ChildText("div.map-stats-infobox-stats div.map-stats-infobox-maps-played")

			if aWr == "-" {
				aWr = "0"
			} else {
				aWr = strings.Split(aWr, "%")[0]
			}

			aP = strings.Split(aP, " ")[0]

			bWr := x.ChildText("div.map-stats-infobox-stats:last-child div.map-stats-infobox-winpercentage  a")
			bP := x.ChildText("div.map-stats-infobox-stats:last-child div.map-stats-infobox-maps-played")

			if bWr == "-" {
				bWr = "0"
			} else {
				bWr = strings.Split(bWr, "%")[0]
			}

			bP = strings.Split(bP, " ")[0]

			mapsCompare = append(mapsCompare, mapName, aWr, aP, bWr, bP)
		})

		comingMatch.MapStats = strings.Join(mapsCompare, ",")
	})

	c.OnHTML(".past-matches", func(e *colly.HTMLElement) {
		var aPastMatches, bPastMatches []string
		e.ForEach("div.flexbox.fix-half-width-margin div.half-width.standard-box:first-child table tr td:first-child a", func(n int, x *colly.HTMLElement) {
			crawlPastMatch(hltvDomain + x.Attr("href"))
			aPastMatches = append(aPastMatches, x.Attr("href"))
		})
		e.ForEach("div.flexbox.fix-half-width-margin div.half-width.standard-box:last-child table tr td:first-child a", func(n int, x *colly.HTMLElement) {
			crawlPastMatch(hltvDomain + x.Attr("href"))
			bPastMatches = append(bPastMatches, x.Attr("href"))
		})

		comingMatch.APastMatches = strings.Join(aPastMatches, ",")
		comingMatch.BPastMatches = strings.Join(bPastMatches, ",")
	})

	c.Visit(hltvDomain + link)
}

func crawlPastMatch(link string) {
	c := colly.NewCollector()
	var latestEventId string
	var currentmapname string
	var currentmatchid string
	var currentseriesid string
	var currentseriestype string
	var currenturl string

	// TODO: fix
	latestEventId = "xx"

	c.OnHTML(".a-reset.small-event.standard-box", func(e *colly.HTMLElement) {
		// If attribute class is this long string return from callback
		// As this a is irrelevant
		link := e.Attr("href")

		linkComponents := strings.Split(link, "/")

		newEvent := models.Event{
			Slug:      linkComponents[3],
			Id:        linkComponents[2],
			Name:      e.ChildText(".table-holder table tbody tr:first-child td:first-child"),
			NoTeams:   e.ChildText(".table-holder table tbody tr:first-child td:nth-child(2)"),
			PrizePool: e.ChildText(".table-holder table tbody tr:first-child td:nth-child(3)"),
			EventType: e.ChildText(".table-holder table tbody tr:first-child td:last-child"),
			Country:   e.ChildAttr(".table-holder table tbody tr:last-child td:first-child span.smallCountry img", "alt"),
			UnixFrom:  e.ChildAttr(".table-holder table tbody tr:last-child td:first-child span:last-child span span:first-child", "data-unix"),
			UnixTo:    e.ChildAttr(".table-holder table tbody tr:last-child td:first-child span:last-child span span:last-child span", "data-unix"),
		}

		err := infra.PostgreSql.Create(&newEvent).Error
		if err != nil {
			fmt.Println(err, newEvent.Id)
		}
		latestEventId = newEvent.Id
		fmt.Printf("------------ new event %s\n", latestEventId)

		e.Request.Visit(link)

		e.Request.Visit(fmt.Sprintf("https://www.hltv.org/results?event=%s", newEvent.Id))
	})

	c.OnHTML(".teams-attending.grid .standard-box.team-box", func(e *colly.HTMLElement) {
		invitedOrNot := e.ChildText(".sub-text.text-ellipsis")
		if invitedOrNot != "Qualifier" && invitedOrNot != "Europe" && invitedOrNot != "Asia" && invitedOrNot != "North America" && invitedOrNot != "CIS" && invitedOrNot != "Oceania" && invitedOrNot != "South America" {
			return
		}

		tfQ := models.TeamsFromQualifier{
			EventId: latestEventId,
			TeamId:  strings.Split(e.ChildAttr(".team-name a", "href"), "/")[2],
		}

		err := infra.PostgreSql.Create(&tfQ).Error
		if err != nil {
			fmt.Println(err, "Error creating team qualifier")
		}
	})

	c.OnHTML(".result-con a.a-reset", func(e *colly.HTMLElement) {
		link := e.Attr("href")
		currentseriesid = strings.Split(link, "/")[2]
		currentseriestype = e.ChildText(".star-cell .map.map-text")
		if currentseriestype != "bo3" && currentseriestype != "bo5" {
			currentseriestype = "bo1"
		}
		e.Request.Visit(link)
	})

	c.OnHTML(".mapholder", func(e *colly.HTMLElement) {
		currentmapname = e.ChildText(".played .map-name-holder .mapname")
		link := e.ChildAttr(".results a", "href")
		if len(link) == 0 {
			return
		}
		currentmatchid = strings.Split(link, "/")[4]

		matchInDB := models.Match{}
		infra.PostgreSql.Model(models.Match{}).Where("id = ?", currentmatchid).Find(&matchInDB)
		if matchInDB.SeriesId != "" {
			return
		}

		currenturl = link
		e.Request.Visit(link)
	})

	c.OnHTML(".stats-section.stats-match", func(e *colly.HTMLElement) {
		father := ".wide-grid .col.match-info-box-col .match-info-box-con "
		a_t_pistol, a_ct_pistol, b_t_pistol, b_ct_pistol := false, false, false, false
		a_f5r, b_f5r := false, false
		round_history := models.Round_history{}
		total := 0
		ct, t := 0, 0

		e.ForEach(".round-history-outcome", func(index int, round *colly.HTMLElement) {
			img := round.Attr("src")
			parts := strings.Split(img, "/")
			imageName := strings.Split(parts[len(parts)-1], ".")[0]
			ct_win := true
			result := ""

			switch imageName {
			case "emptyHistory":
				return
			case "stopwatch":
				ct_win = true
				result = "sw"
			case "bomb_defused":
				ct_win = true
				result = "bd"
			case "ct_win":
				ct_win = true
				result = "cw"
			case "bomb_exploded":
				ct_win = false
				result = "be"
			case "t_win":
				ct_win = false
				result = "tw"
			}
			total += 1
			roundNo := 0
			for _, i := range strings.Split(round.Attr("title"), "-") {
				shit, _ := strconv.Atoi(i)
				roundNo += shit
			}

			switch roundNo {
			case 1:
				round_history.R1 = result
			case 2:
				round_history.R2 = result
			case 3:
				round_history.R3 = result
			case 4:
				round_history.R4 = result
			case 5:
				round_history.R5 = result
			case 6:
				round_history.R6 = result
			case 7:
				round_history.R7 = result
			case 8:
				round_history.R8 = result
			case 9:
				round_history.R9 = result
			case 10:
				round_history.R10 = result
			case 11:
				round_history.R11 = result
			case 12:
				round_history.R12 = result
			case 13:
				round_history.R13 = result
			case 14:
				round_history.R14 = result
			case 15:
				round_history.R15 = result
			case 16:
				round_history.R16 = result
			case 17:
				round_history.R17 = result
			case 18:
				round_history.R18 = result
			case 19:
				round_history.R19 = result
			case 20:
				round_history.R20 = result
			case 21:
				round_history.R21 = result
			case 22:
				round_history.R22 = result
			case 23:
				round_history.R23 = result
			case 24:
				round_history.R24 = result
			case 25:
				round_history.R25 = result
			case 26:
				round_history.R26 = result
			case 27:
				round_history.R27 = result
			case 28:
				round_history.R28 = result
			case 29:
				round_history.R29 = result
			case 30:
				round_history.R30 = result
			}

			if ct_win {
				ct++
			} else {
				t++
			}

			if roundNo == 5 {
				if ct > t {
					a_f5r = true
				} else {
					b_f5r = true
				}
			}

			if roundNo == 1 {
				if ct_win {
					a_ct_pistol = true
				} else {
					b_t_pistol = true
				}
			}
			if roundNo == 16 {
				if ct_win {
					b_ct_pistol = true
				} else {
					a_t_pistol = true
				}
			}
		})

		a_t, a_ct, b_t, b_ct := "", "", "", ""
		init, ctfirst := false, false

		e.ForEach(father+".match-info-row .right span", func(index int, span *colly.HTMLElement) {
			class := span.Attr("class")
			if class != "ct-color" && class != "t-color" {
				return
			}
			if class == "ct-color" {
				if !init {
					init = true
					ctfirst = true
				}

				if len(a_ct) == 0 {
					a_ct = span.Text
				} else {
					b_ct = span.Text
				}
			}
			if class == "t-color" {
				if !init {
					init = true
					ctfirst = false
				}

				if len(b_t) == 0 {
					b_t = span.Text
				} else {
					a_t = span.Text
				}
			}
		})

		if !ctfirst {
			a_ct, b_ct = b_ct, a_ct
			a_t, b_t = b_t, a_t
			a_f5r, b_f5r = b_f5r, a_f5r
			a_ct_pistol, b_ct_pistol = b_ct_pistol, a_ct_pistol
			a_t_pistol, b_t_pistol = b_t_pistol, a_t_pistol
		}

		match := models.Match{
			Id:          currentmatchid,
			SeriesId:    currentseriesid,
			Url:         currenturl,
			SeriesType:  currentseriestype,
			Eventid:     latestEventId,
			A:           strings.Split(e.ChildAttr(father+".match-info-box .team-left a", "href"), "/")[3],
			B:           strings.Split(e.ChildAttr(father+".match-info-box .team-right a", "href"), "/")[3],
			Mapname:     currentmapname,
			A_t_pistol:  a_t_pistol,
			A_ct_pistol: a_ct_pistol,
			A_f5r:       a_f5r,
			B_f5r:       b_f5r,
			B_t_pistol:  b_t_pistol,
			B_ct_pistol: b_ct_pistol,
			A_ct:        a_ct,
			A_t:         a_t,
			B_ct:        b_ct,
			B_t:         b_t,
			A_rating:    strings.Split(e.ChildText(father+".match-info-row:nth-of-type(3) .right"), ":")[0],
			B_rating:    strings.Split(e.ChildText(father+".match-info-row:nth-of-type(3) .right"), ":")[1],
			A_fk:        strings.Split(e.ChildText(father+".match-info-row:nth-of-type(4) .right"), ":")[0],
			B_fk:        strings.Split(e.ChildText(father+".match-info-row:nth-of-type(4) .right"), ":")[1],
			A_cw:        strings.Split(e.ChildText(father+".match-info-row:last-of-type .right"), ":")[0],
			B_cw:        strings.Split(e.ChildText(father+".match-info-row:last-of-type .right"), ":")[1],
		}

		err := infra.PostgreSql.Create(&match).Error
		if err != nil {
			fmt.Println(err)
			return
		}

		e.ForEach(".stats-table tbody tr", func(index int, tr *colly.HTMLElement) {
			hs, fa := "0", "0"
			kill_col := strings.Split(tr.ChildText("td:nth-child(2)"), "(")
			if len(kill_col) > 1 {
				hs = strings.TrimSuffix(kill_col[1], ")")
			}

			assit_col := strings.Split(tr.ChildText("td:nth-child(3)"), "(")
			if len(assit_col) > 1 {
				fa = strings.TrimSuffix(assit_col[1], ")")
			}

			teamid := match.A
			if index > 4 {
				teamid = match.B
			}
			pp := models.Pp{
				Matchid: currentmatchid,
				Teamid:  teamid,
				Country: tr.ChildAttr("td:first-child span img", "alt"),
				Id:      strings.Split(tr.ChildAttr("td:first-child a", "href"), "/")[3],
				K:       kill_col[0],
				Hs:      hs,
				A:       assit_col[0],
				Fa:      fa,
				D:       tr.ChildText("td:nth-child(4)"),
				Kast:    strings.Split(tr.ChildText("td:nth-child(5)"), "%")[0],
				Adr:     tr.ChildText("td:nth-child(7)"),
				R:       tr.ChildText("td:nth-child(9)"),
			}

			err = infra.PostgreSql.Create(&pp).Error
			if err != nil {
				fmt.Println(err)
			}
		})

		round_history.Total = total
		round_history.Matchid = currentmatchid

		err = infra.PostgreSql.Create(&round_history).Error
		if err != nil {
			fmt.Println(err)
		}

	})

	c.Visit(link)
}

func crawlTeam() {
	c := colly.NewCollector()
	c.OnHTML(".stats-table.player-ratings-table tbody", func(e *colly.HTMLElement) {
		e.ForEach("tr td.teamCol-teams-overview", func(index int, row *colly.HTMLElement) {
			team := models.Team{
				Country: row.ChildAttr("img", "title"),
				Id:      strings.Split(row.ChildAttr("a", "href"), "/")[3],
				Name:    row.ChildText("a"),
			}

			err := infra.PostgreSql.Create(&team).Error
			if err != nil {
				fmt.Println(err)
			}
		})
	})

	c.Visit(teamLink)
}

func crawlOdds() {
	c := colly.NewCollector()
	c.OnHTML(".bookmakerMatch", func(e *colly.HTMLElement) {
		matchLink := e.ChildAttr("tbody tr:first-child td.bookmakerTeamBox div a", "href")

		existingMatch := models.MatchOdd{}
		infra.PostgreSql.Model(models.MatchOdd{}).Where("link = ?", matchLink).Find(&existingMatch)

		if existingMatch.Id == 0 {
			go crawlComingMatch(matchLink)
		}

		teamA := e.ChildText("tbody tr:first-child td.bookmakerTeamBox div a")
		teamB := e.ChildText("tbody tr:last-child td.bookmakerTeamBox div a")

		oddsA, oddsB := "", ""
		var averageA, averageB float32
		amount := 0

		e.ForEach("tbody tr:first-child td.odds.betting-list-odds", func(num int, x *colly.HTMLElement) {
			if len(x.Text) > 0 {
				oddsA += "," + x.Text
				tmp, _ := strconv.ParseFloat(x.Text, 32)
				amount++
				averageA += float32(tmp)
			}
		})

		e.ForEach("tbody tr:last-child td.odds.betting-list-odds", func(num int, x *colly.HTMLElement) {
			if len(x.Text) > 0 {
				oddsB += "," + x.Text
				tmp, _ := strconv.ParseFloat(x.Text, 32)
				averageB += float32(tmp)
			}
		})

		match := models.MatchOdd{
			Link:     matchLink,
			A:        teamA,
			B:        teamB,
			OddsA:    oddsA,
			OddsB:    oddsB,
			AverageA: averageA / float32(amount),
			AverageB: averageB / float32(amount),
		}

		var existedMatch models.MatchOdd
		infra.PostgreSql.Model(models.MatchOdd{}).Where("link = ?", matchLink).Order("created_at desc").Limit(1).Find(&existedMatch)
		// if existedMatch.OddsA != match.OddsA || existedMatch.OddsB != match.OddsB {
		if existedMatch.Id == 0 {
			err := infra.PostgreSql.Create(&match).Error
			if err != nil {
				fmt.Println(err)
			}
		}
	})

	c.Visit(oddsLink)
}

func crawlResult() {
	onGoingMatches := []models.MatchOdd{}
	c := colly.NewCollector()

	infra.PostgreSql.Model(models.MatchOdd{}).Where("finished = false").Find(&onGoingMatches)
	balance := models.Balance{}

	infra.PostgreSql.Model(models.Balance{}).Find(&balance)

	for _, m := range onGoingMatches {
		c.Visit(m.Link)

		c.OnHTML(".standard-box teamsBox", func(e *colly.HTMLElement) {
			scoreA := e.ChildText("div:first-child div div")
			scoreB := e.ChildText("div:last-child div div")

			numA, _ := strconv.Atoi(scoreA)
			numB, _ := strconv.Atoi(scoreB)
			aWon := false

			if numA > numB {
				aWon = true
			}

			m.ScoreA = numA
			m.ScoreB = numB

			if m.BetOnA && aWon {
				m.Won = true
				balance.Total += m.Amount + m.Amount*m.PlayedOdd
			} else if !m.BetOnA && !aWon {
				m.Won = true
			}

			m.Finished = true

			infra.PostgreSql.Save(&m)
			infra.PostgreSql.Save(&balance)
		})
	}
}

func handler(w http.ResponseWriter, r *http.Request) {
	onGoingMatches := []models.MatchOdd{}
	balance := models.Balance{}

	infra.PostgreSql.Model(models.MatchOdd{}).Where("finished = false").Where("amount > 0").Find(&onGoingMatches)
	infra.PostgreSql.Model(models.Balance{}).Find(&balance)
	fmt.Fprintf(w, "Current bankroll %f\n", balance.Total)

	for _, m := range onGoingMatches {
		kelly := m.KellyA
		if m.KellyA < m.KellyB {
			kelly = m.KellyB
		}
		betOn := m.B
		if m.BetOnA {
			betOn = m.A
		}
		status := "ONGOING"
		if m.Finished {
			if m.Won {
				status = "WON"
			} else {
				status = "LOST"
			}
		}
		fmt.Fprintf(w, "Bet %f, %f%% of bankroll on %s, with odd %f, status: %s\n", m.Amount, kelly, betOn, m.PlayedOdd, status)

	}
}

func main() {
	c := cron.New()
	heroku, _ := strconv.ParseBool(os.Getenv("USE_HEROKU"))

	infra.InitPostgreSQL(heroku)
	// crawlTeam()
	c.AddFunc("@every 2m", crawlOdds)
	c.AddFunc("@every 1m", crawlVP)
	c.AddFunc("@every 10m", crawlResult)
	c.Start()

	http.HandleFunc("/", handler)
	port := os.Getenv("PORT")
	log.Fatal(http.ListenAndServe("0.0.0.0:"+port, nil))
}
