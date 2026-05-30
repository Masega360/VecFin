package handler

import (
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/Masega360/vecfin/backend/internal/usecase"
	"github.com/google/uuid"
)

type FiscalReportHandler struct {
	uc *usecase.FiscalReportUsecase
}

func NewFiscalReportHandler(uc *usecase.FiscalReportUsecase) *FiscalReportHandler {
	return &FiscalReportHandler{uc: uc}
}

func (h *FiscalReportHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)
	http.HandleFunc("GET /users/me/fiscal-report", auth(h.Generate))
}

func (h *FiscalReportHandler) Generate(w http.ResponseWriter, r *http.Request) {
	userIDStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	pdfBytes, err := h.uc.Generate(userID)
	if err != nil {
		http.Error(w, "Error generando reporte: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "attachment; filename=reporte_fiscal.pdf")
	w.Write(pdfBytes)
}
