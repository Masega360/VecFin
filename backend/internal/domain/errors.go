package domain

import "errors"

var ErrNotFound = errors.New("not found")
var ErrForbidden = errors.New("forbidden")
var ErrNoAPICredentials = errors.New("la wallet no tiene credenciales de API configuradas")
var ErrExchangeNotSupported = errors.New("exchange no soportado para esta plataforma")
