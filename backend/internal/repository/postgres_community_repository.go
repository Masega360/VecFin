package repository

import (
	"database/sql"
	"errors"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/lib/pq" // CRUCIAL para manejar arrays en Postgres
)

type PostgresCommunityRepository struct {
	db *sql.DB
}

func NewPostgresCommunityRepository(db *sql.DB) *PostgresCommunityRepository {
	return &PostgresCommunityRepository{db: db}
}

// ==========================================
// GESTION DE COMUNIDADES
// ==========================================

func (r *PostgresCommunityRepository) Create(c domain.Community) error {
	query := `
        INSERT INTO communities (id, creator_id, name, description, rules, topics, logo_url, is_private, creation_date, member_count, post_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `
	_, err := r.db.Exec(query, c.ID, c.CreatorID, c.Name, c.Description, c.Rules, pq.Array(c.Topics), c.LogoUrl, c.IsPrivate, c.CreationDate, c.MemberCount, c.PostCount)
	return err
}

func (r *PostgresCommunityRepository) FindByID(id uuid.UUID) (domain.Community, error) {
	var c domain.Community
	query := `
        SELECT id, creator_id, name, description, rules, topics, COALESCE(logo_url, ''), is_private, creation_date, member_count, post_count
        FROM communities WHERE id = $1
    `
	err := r.db.QueryRow(query, id).Scan(
		&c.ID, &c.CreatorID, &c.Name, &c.Description, &c.Rules, pq.Array(&c.Topics), &c.LogoUrl, &c.IsPrivate, &c.CreationDate, &c.MemberCount, &c.PostCount,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return domain.Community{}, errors.New("Comunidad no encontrada")
		}
		return domain.Community{}, err
	}
	return c, nil
}

func (r *PostgresCommunityRepository) Search(searchQuery string) ([]domain.Community, error) {
	var comms []domain.Community
	searchTerm := "%" + searchQuery + "%"

	// Buscamos en el nombre, en la descripcion, o si la palabra exacta coincide con uno de los topics
	query := `
        SELECT id, creator_id, name, description, rules, topics, COALESCE(logo_url, ''), is_private, creation_date, member_count, post_count
        FROM communities 
        WHERE name ILIKE $1 OR description ILIKE $1 OR $2 = ANY(topics)
        ORDER BY member_count DESC 
    `
	rows, err := r.db.Query(query, searchTerm, searchQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var c domain.Community
		if err := rows.Scan(
			&c.ID, &c.CreatorID, &c.Name, &c.Description, &c.Rules, pq.Array(&c.Topics), &c.LogoUrl, &c.IsPrivate, &c.CreationDate, &c.MemberCount, &c.PostCount,
		); err != nil {
			return nil, err
		}
		comms = append(comms, c)
	}
	return comms, nil
}

func (r *PostgresCommunityRepository) Update(c domain.Community) error {
	query := `
        UPDATE communities
        SET name = $1, description = $2, rules = $3, topics = $4, logo_url = $5, is_private = $6, member_count = $7, post_count = $8
        WHERE id = $9
    `
	_, err := r.db.Exec(query, c.Name, c.Description, c.Rules, pq.Array(c.Topics), c.LogoUrl, c.IsPrivate, c.MemberCount, c.PostCount, c.ID)
	return err
}

func (r *PostgresCommunityRepository) Delete(id uuid.UUID) error {
	query := `DELETE FROM communities WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

// ==========================================
// GESTION DE MIEMBROS
// ==========================================

func (r *PostgresCommunityRepository) AddMember(member domain.CommunityMember) error {
	query := `
        INSERT INTO community_members (community_id, user_id, role, joined_at)
        VALUES ($1, $2, $3, $4)
    `
	_, err := r.db.Exec(query, member.CommunityID, member.UserID, member.Role, member.JoinedAt)
	return err
}

func (r *PostgresCommunityRepository) FindMember(communityID, userID uuid.UUID) (domain.CommunityMember, error) {
	var m domain.CommunityMember
	query := `SELECT community_id, user_id, role, joined_at FROM community_members WHERE community_id = $1 AND user_id = $2`

	err := r.db.QueryRow(query, communityID, userID).Scan(&m.CommunityID, &m.UserID, &m.Role, &m.JoinedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return domain.CommunityMember{}, errors.New("El usuario no es miembro de esta comunidad")
		}
		return domain.CommunityMember{}, err
	}
	return m, nil
}

func (r *PostgresCommunityRepository) UpdateMember(member domain.CommunityMember) error {
	query := `UPDATE community_members SET role = $1 WHERE community_id = $2 AND user_id = $3`
	_, err := r.db.Exec(query, member.Role, member.CommunityID, member.UserID)
	return err
}

func (r *PostgresCommunityRepository) RemoveMember(communityID, userID uuid.UUID) error {
	query := `DELETE FROM community_members WHERE community_id = $1 AND user_id = $2`
	_, err := r.db.Exec(query, communityID, userID)
	return err
}

func (r *PostgresCommunityRepository) CountOwners(communityID uuid.UUID) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM community_members WHERE community_id = $1 AND role = 'owner'`
	err := r.db.QueryRow(query, communityID).Scan(&count)
	return count, err
}

// GESTION DE SOLICITUDES (PRIVADAS)

func (r *PostgresCommunityRepository) CreateJoinRequest(req domain.JoinRequest) error {
	query := `
        INSERT INTO community_join_requests (community_id, user_id, status, created_at)
        VALUES ($1, $2, $3, $4)
    `
	_, err := r.db.Exec(query, req.CommunityID, req.UserID, req.Status, req.CreatedAt)
	return err
}

func (r *PostgresCommunityRepository) GetJoinRequest(communityID, userID uuid.UUID) (domain.JoinRequest, error) {
	var req domain.JoinRequest
	query := `SELECT community_id, user_id, status, created_at FROM community_join_requests WHERE community_id = $1 AND user_id = $2`

	err := r.db.QueryRow(query, communityID, userID).Scan(&req.CommunityID, &req.UserID, &req.Status, &req.CreatedAt)
	if err != nil {
		return domain.JoinRequest{}, err
	}
	return req, nil
}

func (r *PostgresCommunityRepository) UpdateJoinRequestStatus(communityID, userID uuid.UUID, status domain.RequestStatus) error {
	query := `UPDATE community_join_requests SET status = $1 WHERE community_id = $2 AND user_id = $3`
	_, err := r.db.Exec(query, status, communityID, userID)
	return err
}
