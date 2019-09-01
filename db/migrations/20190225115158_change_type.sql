
-- +goose Up
-- SQL in section 'Up' is executed when this migration is applied

alter table matches
alter column a_t type int using a_t::int,
alter column a_ct type int using a_ct::int,
alter column b_t type int using b_t::int,
alter column b_ct type int using b_ct::int,
alter column a_rating type float using a_rating::float,
alter column b_rating type float using b_rating::float,
alter column a_fk type int using a_fk::int,
alter column b_fk type int using b_fk::int,
alter column a_cw type int using a_cw::int,
alter column b_cw type int using b_cw::int;

alter table pps
alter column k type int using k::int,
alter column hs type int using hs::int,
alter column a type int using a::int,
alter column fa type int using fa::int,
alter column d type int using d::int,
alter column kast type float using kast::float,
alter column adr type float using adr::float,
alter column r type float using r::float;

-- +goose Down
-- SQL section 'Down' is executed when this migration is rolled back

