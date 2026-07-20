package handler

import (
	"context"
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

type walletExportRow struct {
	WalletName string
	Ticker     string
	Quantity   float64
}

// CommunityWalletExportHandler expone el endpoint de exportación CSV/Excel
// de las wallets de una comunidad.
type CommunityWalletExportHandler struct {
	communityWalletRepo domain.CommunityWalletRepository
	assetWalletRepo     domain.AssetWalletRepository
}

func NewCommunityWalletExportHandler(
	cwRepo domain.CommunityWalletRepository,
	awRepo domain.AssetWalletRepository,
) *CommunityWalletExportHandler {
	return &CommunityWalletExportHandler{
		communityWalletRepo: cwRepo,
		assetWalletRepo:     awRepo,
	}
}

func (h *CommunityWalletExportHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)
	http.HandleFunc("GET /communities/{id}/wallets/export", auth(h.Export))
}

// Export genera un archivo CSV o Excel con los assets de todas las wallets de la comunidad.
// Query params:
//   - format: "csv" (default) o "xlsx"
func (h *CommunityWalletExportHandler) Export(w http.ResponseWriter, r *http.Request) {
	// Validar usuario autenticado
	userStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	if _, err := uuid.Parse(userStr); err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}

	communityID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "id de comunidad inválido", http.StatusBadRequest)
		return
	}

	format := r.URL.Query().Get("format")
	if format == "" {
		format = "csv"
	}
	if format != "csv" && format != "xlsx" {
		http.Error(w, "formato inválido: usar 'csv' o 'xlsx'", http.StatusBadRequest)
		return
	}

	// Obtener wallets de la comunidad
	wallets, err := h.communityWalletRepo.ListByCommunity(r.Context(), communityID)
	if err != nil {
		http.Error(w, "error al obtener wallets de la comunidad", http.StatusInternalServerError)
		return
	}

	// Construir la data: para cada wallet, obtener sus assets
	var rows []walletExportRow
	for _, wallet := range wallets {
		assets, err := h.assetWalletRepo.ListByWallet(context.Background(), wallet.ID)
		if err != nil {
			continue
		}
		for _, asset := range assets {
			rows = append(rows, walletExportRow{
				WalletName: wallet.Name,
				Ticker:     asset.Ticker,
				Quantity:   asset.Quantity,
			})
		}
	}

	switch format {
	case "csv":
		h.exportCSV(w, rows)
	case "xlsx":
		h.exportExcel(w, rows)
	}
}

func (h *CommunityWalletExportHandler) exportCSV(w http.ResponseWriter, rows []walletExportRow) {
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=community_wallets.csv")

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Header
	_ = writer.Write([]string{"Wallet", "Ticker", "Cantidad"})

	for _, row := range rows {
		_ = writer.Write([]string{
			row.WalletName,
			row.Ticker,
			strconv.FormatFloat(row.Quantity, 'f', -1, 64),
		})
	}
}

func (h *CommunityWalletExportHandler) exportExcel(w http.ResponseWriter, rows []walletExportRow) {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Wallets"
	idx, _ := f.NewSheet(sheet)
	f.SetActiveSheet(idx)
	f.DeleteSheet("Sheet1")

	// Headers
	f.SetCellValue(sheet, "A1", "Wallet")
	f.SetCellValue(sheet, "B1", "Ticker")
	f.SetCellValue(sheet, "C1", "Cantidad")

	// Estilo bold para headers
	style, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
	})
	f.SetCellStyle(sheet, "A1", "C1", style)

	// Data
	for i, row := range rows {
		rowNum := i + 2
		f.SetCellValue(sheet, fmt.Sprintf("A%d", rowNum), row.WalletName)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", rowNum), row.Ticker)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", rowNum), row.Quantity)
	}

	// Ancho de columnas
	f.SetColWidth(sheet, "A", "A", 25)
	f.SetColWidth(sheet, "B", "B", 15)
	f.SetColWidth(sheet, "C", "C", 15)

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", "attachment; filename=community_wallets.xlsx")

	if err := f.Write(w); err != nil {
		http.Error(w, "error generando excel", http.StatusInternalServerError)
	}
}
