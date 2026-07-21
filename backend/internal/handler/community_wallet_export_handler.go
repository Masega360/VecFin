package handler

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/go-pdf/fpdf"
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
	http.HandleFunc("GET /communities/{id}/wallets", auth(h.ListWallets))
	http.HandleFunc("POST /communities/{id}/wallets", auth(h.LinkWallet))
	http.HandleFunc("DELETE /communities/{id}/wallets/{wallet_id}", auth(h.UnlinkWallet))
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
	if format != "csv" && format != "xlsx" && format != "pdf" {
		http.Error(w, "formato inválido: usar 'csv', 'xlsx' o 'pdf'", http.StatusBadRequest)
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
	case "pdf":
		h.exportPDF(w, rows)
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

func (h *CommunityWalletExportHandler) exportPDF(w http.ResponseWriter, rows []walletExportRow) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetAutoPageBreak(true, 20)
	pdf.AddPage()

	// Header
	pdf.SetFont("Arial", "B", 18)
	pdf.Cell(0, 12, "Wallets de la Comunidad")
	pdf.Ln(14)

	pdf.SetFont("Arial", "", 11)
	pdf.Cell(0, 7, fmt.Sprintf("Total de activos: %d", len(rows)))
	pdf.Ln(12)

	// Table header
	pdf.SetFont("Arial", "B", 10)
	pdf.SetFillColor(0, 173, 216)
	pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(60, 8, "Wallet", "1", 0, "C", true, 0, "")
	pdf.CellFormat(50, 8, "Ticker", "1", 0, "C", true, 0, "")
	pdf.CellFormat(50, 8, "Cantidad", "1", 1, "C", true, 0, "")

	// Table rows
	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(0, 0, 0)
	for _, row := range rows {
		pdf.CellFormat(60, 7, row.WalletName, "1", 0, "L", false, 0, "")
		pdf.CellFormat(50, 7, row.Ticker, "1", 0, "C", false, 0, "")
		pdf.CellFormat(50, 7, strconv.FormatFloat(row.Quantity, 'f', 4, 64), "1", 1, "R", false, 0, "")
	}

	// Footer
	pdf.Ln(10)
	pdf.SetFont("Arial", "I", 8)
	pdf.Cell(0, 5, "Generado por VecFin")

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		http.Error(w, "error generando PDF", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "attachment; filename=community_wallets.pdf")
	w.Write(buf.Bytes())
}

// ListWallets devuelve las wallets vinculadas a la comunidad.
func (h *CommunityWalletExportHandler) ListWallets(w http.ResponseWriter, r *http.Request) {
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

	wallets, err := h.communityWalletRepo.ListByCommunity(r.Context(), communityID)
	if err != nil {
		http.Error(w, "error al obtener wallets", http.StatusInternalServerError)
		return
	}
	if wallets == nil {
		wallets = []domain.Wallet{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(wallets)
}

// LinkWallet vincula una wallet a la comunidad.
// Body: { "wallet_id": "uuid" }
func (h *CommunityWalletExportHandler) LinkWallet(w http.ResponseWriter, r *http.Request) {
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

	var body struct {
		WalletID string `json:"wallet_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "solicitud inválida", http.StatusBadRequest)
		return
	}
	walletID, err := uuid.Parse(body.WalletID)
	if err != nil {
		http.Error(w, "wallet_id inválido", http.StatusBadRequest)
		return
	}

	if err := h.communityWalletRepo.Link(r.Context(), communityID, walletID); err != nil {
		http.Error(w, "error al vincular wallet", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

// UnlinkWallet desvincula una wallet de la comunidad.
func (h *CommunityWalletExportHandler) UnlinkWallet(w http.ResponseWriter, r *http.Request) {
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
	walletID, err := uuid.Parse(r.PathValue("wallet_id"))
	if err != nil {
		http.Error(w, "wallet_id inválido", http.StatusBadRequest)
		return
	}

	if err := h.communityWalletRepo.Unlink(r.Context(), communityID, walletID); err != nil {
		http.Error(w, "error al desvincular wallet", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
