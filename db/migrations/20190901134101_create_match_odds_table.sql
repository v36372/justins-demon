
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

create table match_odds(
	id serial primary key,
	link varchar(100),
	a varchar(100),
	b varchar(100),
	a_id int,
	b_id int,
	odds_a varchar(200),
	odds_b varchar(200),
	average_a float,
	average_b float,
	kelly_a float,
	kelly_b float,
	finished boolean,
	won boolean,
	bet_on_a boolean,
	score_a int,
	score_b int,
	amount float,
	played_odd float,
	created_at timestamptz not null default current_timestamp
);

-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back

drop table match_odds;
