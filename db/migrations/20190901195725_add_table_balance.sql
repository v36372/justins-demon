
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

create table balances (
	total float
);

insert into balances(total) values(1000);
-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back

drop table balances;
