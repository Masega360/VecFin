package pdf

import (
	"bytes"
	"fmt"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/go-pdf/fpdf"
)

type FPDFGenerator struct{}

func NewFPDFGenerator() *FPDFGenerator { return &FPDFGenerator{} }

func (g *FPDFGenerator) GenerateFiscalReport(report domain.FiscalReport) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetAutoPageBreak(true, 20)
	pdf.AddPage()

	// Header
	pdf.SetFont("Arial", "B", 18)
	pdf.Cell(0, 12, "Reporte Fiscal de Tenencias")
	pdf.Ln(14)

	pdf.SetFont("Arial", "", 11)
	pdf.Cell(0, 7, fmt.Sprintf("Usuario: %s", report.UserName))
	pdf.Ln(6)
	pdf.Cell(0, 7, fmt.Sprintf("Email: %s", report.Email))
	pdf.Ln(6)
	pdf.Cell(0, 7, fmt.Sprintf("Fecha: %s", report.GeneratedAt.Format("02/01/2006 15:04")))
	pdf.Ln(12)

	// Table header
	pdf.SetFont("Arial", "B", 10)
	pdf.SetFillColor(0, 173, 216)
	pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(25, 8, "Ticker", "1", 0, "C", true, 0, "")
	pdf.CellFormat(45, 8, "Nombre", "1", 0, "C", true, 0, "")
	pdf.CellFormat(25, 8, "Cantidad", "1", 0, "C", true, 0, "")
	pdf.CellFormat(30, 8, "Precio USD", "1", 0, "C", true, 0, "")
	pdf.CellFormat(30, 8, "Total USD", "1", 0, "C", true, 0, "")
	pdf.CellFormat(35, 8, "Wallet", "1", 1, "C", true, 0, "")

	// Table rows
	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(0, 0, 0)
	for _, line := range report.Lines {
		pdf.CellFormat(25, 7, line.Ticker, "1", 0, "C", false, 0, "")
		pdf.CellFormat(45, 7, truncate(line.Name, 22), "1", 0, "L", false, 0, "")
		pdf.CellFormat(25, 7, fmt.Sprintf("%.4f", line.Quantity), "1", 0, "R", false, 0, "")
		pdf.CellFormat(30, 7, fmt.Sprintf("$%.2f", line.PriceUSD), "1", 0, "R", false, 0, "")
		pdf.CellFormat(30, 7, fmt.Sprintf("$%.2f", line.TotalUSD), "1", 0, "R", false, 0, "")
		pdf.CellFormat(35, 7, truncate(line.WalletName, 16), "1", 1, "L", false, 0, "")
	}

	// Total
	pdf.Ln(4)
	pdf.SetFont("Arial", "B", 12)
	pdf.Cell(0, 10, fmt.Sprintf("Total patrimonio: $%.2f USD", report.TotalUSD))

	// Footer disclaimer
	pdf.Ln(16)
	pdf.SetFont("Arial", "I", 8)
	pdf.MultiCell(0, 4, "Este reporte es informativo y refleja las tenencias registradas en VecFin al momento de su generacion. No constituye asesoramiento fiscal. Consulte a un profesional contable para su declaracion jurada.", "", "L", false)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max-1] + "."
}
