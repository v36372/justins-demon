
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

create table series_odds(
	series_id varchar(100),
	a_win varchar(100),
	b_win varchar(100),
	created_at timestamptz not null default current_timestamp
);

-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back

drop table series_odds;
