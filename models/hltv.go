package models

type HltvAnalytics struct {
	url               string
	a                 Team
	b                 Team
	insight_a_favor   []Insight
	insight_a_against []Insight
	insight_b_favor   []Insight
	insight_b_against []Insight
	pH2Hs_a           []HltvPlayerH2H
	pH2Hs_b           []HltvPlayerH2H
}

type Insight struct {
	raw string
}

type HltvPlayerH2H struct {
	Three_Months string
	Event        string
}
