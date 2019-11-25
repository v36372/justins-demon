package hltv

import (
	"errors"
	"fmt"
	"justins-demon/infra"
	"justins-demon/models"

	"github.com/gocolly/colly"
)

type AnalyticsCrawler struct {
	analyticsLink string
	c             *colly.Collector
	data          *models.HltvAnalytics
}

func NewAnalyticsCrawler(matchSlug string, a string, b string) *AnalyticsCrawler {
	analyticsLink := fmt.Sprintf("https://www.hltv.org/betting/analytics/%s", matchSlug)
	teama, teamB := models.Team{}, models.Team{}
	infra.PostgreSql.Model(models.Team{}).Where("name = ?", a).Find(&teamA)
	infra.PostgreSql.Model(models.Team{}).Where("name = ?", b).Find(&teamB)

	if teama.Id == 0 {
		// TODO: Add logs
		fmt.Printf("not found team %s\n", a)
	}

	if teamb.Id == 0 {
		// TODO: Add logs
		fmt.Printf("not found team %s\n", a)
	}

	return &AnalyticsCrawler{
		analyticsLink: analyticsLink,
		c:             colly.NewCollector(),
		data: &models.HltvAnalytics{
			url: analyticsLink,
			a:   teama,
			b:   teamb,
		},
	}
}

func (a *AnalyticsCrawler) crawlInsight(e *colly.HTMLElement) {
}

func (a *AnalyticsCrawler) crawlHeadtoHead(e *colly.HTMLElement) error {
	e.ForEach(".analytics-head-to-head-container", func(teamIndex int, teamH2H *colly.HTMLElement) {
		teamH2H.ForEach("tr", func(playerIndex int, playerH2H *colly.HTMLElement) {
			pH2H := models.HltvPlayerH2H{
				Three_Months: playerH2H.ChildText("td.table-3-months"),
				Event:        playerH2H.ChildText("td.table-event"),
			}

			if playerIndex >= 5 {
				return errors.New("crawl player h2h failed because player count larger than 5, %s")
			}
			if teamIndex == 0 {
				a.data.pH2Hs_a.append(playerIndex)
			}

			if teamIndex == 1 {
				a.data.pH2Hs_b.append(playerIndex)
			}
		})

		teamH2H.ForEach(".analytics-last-matches a", func(matchIndex int, matchH2H *colly.HTMLElement) {
			crawlMatch(matchH2H.ChildAttr("href"))
		})
	})
}

func (a *AnalyticsCrawler) crawl() {
	a.c.OnHTML(".analytics-insights", crawlInsight)
	a.c.OnHTML(".head-to-head-section", crawlHeadtoHead)

	a.c.Visit(a.analyticsLink)
}
