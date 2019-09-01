package infra

import (
	"fmt"

	"github.com/jinzhu/gorm"
)

var PostgreSql *gorm.DB

func InitPostgreSQL() {
	source := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		"postgres",
		"postgres",
		"0.0.0.0",
		5432,
		"postgres",
	)
	var err error
	PostgreSql, err = gorm.Open("postgres", source)
	if err != nil {
		panic(err)

	}
	err = PostgreSql.DB().Ping()
	if err != nil {
		panic(err)

	}

	PostgreSql.LogMode(true)

}
