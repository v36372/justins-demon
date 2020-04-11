package hltv

import (
	"fmt"
	"justins-demon/models"
	"strings"

	"github.com/gocolly/colly"
)

type AnalyticsCrawler struct {
	AnalyticsLink string
	C             *colly.Collector
	Data          *models.HltvAnalytics
}

func (ac *AnalyticsCrawler) crawlInsight(e *colly.HTMLElement) {
	e.ForEach(".analytics-insights-container.team1 .analytics-insights-insight", func(index int, insight *colly.HTMLElement) {
		if strings.Contains(insight.ChildAttr("div:first-child", "class"), "against") {
			i := models.Insight{
				Raw: insight.ChildText("div:last-child"),
			}
			ac.Data.A.Insight_against = append(ac.Data.A.Insight_against, i)
		}
		if strings.Contains(insight.ChildAttr("div:first-child", "class"), "in-favor") {
			i := models.Insight{
				Raw: insight.ChildText("div:last-child"),
			}
			ac.Data.A.Insight_favor = append(ac.Data.A.Insight_favor, i)
		}
	})

	e.ForEach(".analytics-insights-container.team2 .analytics-insights-insight", func(index int, insight *colly.HTMLElement) {
		if strings.Contains(insight.ChildAttr("div:first-child", "class"), "against") {
			i := models.Insight{
				Raw: insight.ChildText("div:last-child"),
			}
			ac.Data.B.Insight_against = append(ac.Data.B.Insight_against, i)
		}
		if strings.Contains(insight.ChildAttr("div:first-child", "class"), "in-favor") {
			i := models.Insight{
				Raw: insight.ChildText("div:last-child"),
			}
			ac.Data.B.Insight_favor = append(ac.Data.B.Insight_favor, i)
		}
	})
}

func (a *AnalyticsCrawler) crawlTeamHandicap(e *colly.HTMLElement, teamIndex int) models.Handicap {
	res := models.Handicap{}
	played := e.ChildText("span.match-map-count")
	matches := strings.Split(played, ",")[0]
	maps := strings.Split(played, ",")[1]

	res.Total_matches_played = strings.Split(matches, " ")[0]
	res.Total_maps_played = strings.Split(maps, " ")[1]

	e.ForEach("tbody tr", func(index int, hdc *colly.HTMLElement) {
		switchCondition := "td:first-child"
		if teamIndex == 2 {
			switchCondition = "td:last-child"
		}
		switch hdc.ChildText(switchCondition) {
		case "2 - 0 wins":
			res.Total_2_0_wins = hdc.ChildText("td.handicap-data")
		case "2 - 1 wins":
			res.Total_2_1_wins = hdc.ChildText("td.handicap-data")
		case "0 - 2 losses":
			res.Total_0_2_losses = hdc.ChildText("td.handicap-data")
		case "1 - 2 losses":
			res.Total_1_2_losses = hdc.ChildText("td.handicap-data")
		case "Overtimes":
			res.Total_overtime = hdc.ChildText("td.handicap-data")
		}
	})

	return res
}

func (a *AnalyticsCrawler) crawlHeadtoHead(e *colly.HTMLElement) {
	e.ForEach(".analytics-head-to-head-container", func(teamIndex int, teamH2H *colly.HTMLElement) {
		teamH2H.ForEach("tbody tr", func(playerIndex int, playerH2H *colly.HTMLElement) {
			pH2H := models.HltvPlayerH2H{
				Three_Months: playerH2H.ChildText("td.table-3-months"),
				Event:        playerH2H.ChildText("td.table-event"),
			}

			if playerIndex >= 5 {
				fmt.Printf("crawl player h2h failed because player count larger than 5: %d\n", playerIndex)
				return
			}
			if teamIndex == 0 {
				a.Data.A.PH2Hs = append(a.Data.A.PH2Hs, pH2H)
			}

			if teamIndex == 1 {
				a.Data.B.PH2Hs = append(a.Data.B.PH2Hs, pH2H)
			}
		})

		//teamH2H.ForEach(".analytics-last-matches a", func(matchIndex int, matchH2H *colly.HTMLElement) {
		//crawlMatch(matchH2H.ChildAttr("href"))
		//})
	})
}

func (a *AnalyticsCrawler) Crawl() {
	a.C.OnHTML(".analytics-insights", a.crawlInsight)
	a.C.OnHTML(".head-to-head-section", a.crawlHeadtoHead)
	a.C.OnHTML(".analytics-handicap-table.team1", func(e *colly.HTMLElement) {
		a.Data.A.Handicap = a.crawlTeamHandicap(e, 1)
	})
	a.C.OnHTML(".analytics-handicap-table.team2", func(e *colly.HTMLElement) {
		a.Data.B.Handicap = a.crawlTeamHandicap(e, 2)
	})

	a.C.Visit(a.AnalyticsLink)
}
