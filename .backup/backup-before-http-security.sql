--
-- PostgreSQL database dump
--

\restrict I4oEoBPSHkH0r39r1jxoeuwzrDfgsJb9Wc4UJ4v5eQtufANxaAj41QijTXo9FEg

-- Dumped from database version 17.10 (Debian 17.10-1.pgdg12+1)
-- Dumped by pg_dump version 17.10 (Debian 17.10-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: asihjaya
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO asihjaya;

--
-- Name: approval_execution_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.approval_execution_status AS ENUM (
    'not_started',
    'executing',
    'completed',
    'failed',
    'cancelled'
);


ALTER TYPE public.approval_execution_status OWNER TO asihjaya;

--
-- Name: approval_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.approval_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE public.approval_status OWNER TO asihjaya;

--
-- Name: approval_type; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.approval_type AS ENUM (
    'discount',
    'void_receipt',
    'refund_transaction',
    'manual_payment_verification',
    'stock_adjustment',
    'other',
    'customer_deposit_withdrawal'
);


ALTER TYPE public.approval_type OWNER TO asihjaya;

--
-- Name: cash_movement_type; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.cash_movement_type AS ENUM (
    'opening_balance',
    'cash_sale',
    'cash_refund',
    'cash_in',
    'cash_out',
    'closing_adjustment'
);


ALTER TYPE public.cash_movement_type OWNER TO asihjaya;

--
-- Name: customer_deposit_ledger_direction; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.customer_deposit_ledger_direction AS ENUM (
    'credit',
    'debit'
);


ALTER TYPE public.customer_deposit_ledger_direction OWNER TO asihjaya;

--
-- Name: customer_deposit_ledger_entry_type; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.customer_deposit_ledger_entry_type AS ENUM (
    'deposit_in',
    'deposit_used',
    'deposit_withdrawal',
    'adjustment'
);


ALTER TYPE public.customer_deposit_ledger_entry_type OWNER TO asihjaya;

--
-- Name: hardware_agent_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.hardware_agent_status AS ENUM (
    'online',
    'offline',
    'disabled'
);


ALTER TYPE public.hardware_agent_status OWNER TO asihjaya;

--
-- Name: hardware_device_type; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.hardware_device_type AS ENUM (
    'label_printer',
    'document_printer',
    'cash_drawer',
    'other'
);


ALTER TYPE public.hardware_device_type OWNER TO asihjaya;

--
-- Name: hardware_job_attempt_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.hardware_job_attempt_status AS ENUM (
    'claimed',
    'processing',
    'dispatching',
    'submitted',
    'acknowledged',
    'failed_before_dispatch',
    'unknown_after_dispatch',
    'lease_expired',
    'cancelled'
);


ALTER TYPE public.hardware_job_attempt_status OWNER TO asihjaya;

--
-- Name: hardware_job_resolution_type; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.hardware_job_resolution_type AS ENUM (
    'confirmed_completed',
    'retry_authorized',
    'cancelled'
);


ALTER TYPE public.hardware_job_resolution_type OWNER TO asihjaya;

--
-- Name: hardware_job_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.hardware_job_status AS ENUM (
    'pending',
    'claimed',
    'processing',
    'printing',
    'submitted',
    'completed',
    'failed',
    'unknown_outcome',
    'expired',
    'cancelled'
);


ALTER TYPE public.hardware_job_status OWNER TO asihjaya;

--
-- Name: hardware_job_type; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.hardware_job_type AS ENUM (
    'print_label_sato',
    'print_receipt_certificate',
    'open_cash_drawer',
    'test_label_printer',
    'test_document_printer',
    'test_cash_drawer'
);


ALTER TYPE public.hardware_job_type OWNER TO asihjaya;

--
-- Name: inventory_movement_type; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.inventory_movement_type AS ENUM (
    'goods_receipt',
    'sale',
    'sale_return',
    'transfer_out',
    'transfer_in',
    'reservation',
    'reservation_release',
    'adjustment',
    'damaged',
    'lost',
    'repair_out',
    'repair_in',
    'reversal'
);


ALTER TYPE public.inventory_movement_type OWNER TO asihjaya;

--
-- Name: item_availability; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.item_availability AS ENUM (
    'draft',
    'available',
    'reserved',
    'inspection',
    'sold'
);


ALTER TYPE public.item_availability OWNER TO asihjaya;

--
-- Name: item_condition; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.item_condition AS ENUM (
    'good',
    'damaged',
    'lost',
    'returned'
);


ALTER TYPE public.item_condition OWNER TO asihjaya;

--
-- Name: item_location_state; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.item_location_state AS ENUM (
    'outlet',
    'warehouse',
    'in_transit',
    'customer',
    'repair'
);


ALTER TYPE public.item_location_state OWNER TO asihjaya;

--
-- Name: manual_payment_verification_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.manual_payment_verification_status AS ENUM (
    'self_verified',
    'co_verification_required',
    'co_verified',
    'rejected'
);


ALTER TYPE public.manual_payment_verification_status OWNER TO asihjaya;

--
-- Name: master_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.master_status AS ENUM (
    'draft',
    'active',
    'inactive'
);


ALTER TYPE public.master_status OWNER TO asihjaya;

--
-- Name: notification_category; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.notification_category AS ENUM (
    'sales',
    'payment',
    'cash_shift',
    'inventory_return',
    'hardware',
    'security',
    'system',
    'approval_result'
);


ALTER TYPE public.notification_category OWNER TO asihjaya;

--
-- Name: notification_recipient_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.notification_recipient_status AS ENUM (
    'unread',
    'read',
    'acknowledged',
    'resolved',
    'archived'
);


ALTER TYPE public.notification_recipient_status OWNER TO asihjaya;

--
-- Name: notification_severity; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.notification_severity AS ENUM (
    'info',
    'success',
    'warning',
    'critical'
);


ALTER TYPE public.notification_severity OWNER TO asihjaya;

--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.notification_type AS ENUM (
    'sales',
    'hardware',
    'shift',
    'cash',
    'inventory',
    'system'
);


ALTER TYPE public.notification_type OWNER TO asihjaya;

--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'debit_card',
    'credit_card',
    'bank_transfer',
    'qris_manual',
    'qris_gateway',
    'other'
);


ALTER TYPE public.payment_method OWNER TO asihjaya;

--
-- Name: payment_refund_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.payment_refund_status AS ENUM (
    'requested',
    'approved',
    'processing',
    'confirmed',
    'failed',
    'cancelled'
);


ALTER TYPE public.payment_refund_status OWNER TO asihjaya;

--
-- Name: payment_settlement_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.payment_settlement_status AS ENUM (
    'not_applicable',
    'unreconciled',
    'pending_settlement',
    'reconciled',
    'mismatch',
    'not_found',
    'waived'
);


ALTER TYPE public.payment_settlement_status OWNER TO asihjaya;

--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'paid',
    'failed',
    'expired',
    'cancelled',
    'partially_refunded',
    'refunded'
);


ALTER TYPE public.payment_status OWNER TO asihjaya;

--
-- Name: pos_checkout_attempt_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.pos_checkout_attempt_status AS ENUM (
    'processing',
    'completed',
    'failed'
);


ALTER TYPE public.pos_checkout_attempt_status OWNER TO asihjaya;

--
-- Name: pos_held_cart_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.pos_held_cart_status AS ENUM (
    'active',
    'resumed',
    'canceled'
);


ALTER TYPE public.pos_held_cart_status OWNER TO asihjaya;

--
-- Name: return_inspection_decision; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.return_inspection_decision AS ENUM (
    'restock',
    'repair',
    'damaged',
    'reject'
);


ALTER TYPE public.return_inspection_decision OWNER TO asihjaya;

--
-- Name: sale_return_case_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.sale_return_case_status AS ENUM (
    'awaiting_receipt',
    'pending_inspection',
    'partially_inspected',
    'completed',
    'rejected',
    'cancelled'
);


ALTER TYPE public.sale_return_case_status OWNER TO asihjaya;

--
-- Name: sale_return_item_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.sale_return_item_status AS ENUM (
    'awaiting_receipt',
    'pending_inspection',
    'restocked',
    'repair',
    'damaged',
    'rejected'
);


ALTER TYPE public.sale_return_item_status OWNER TO asihjaya;

--
-- Name: sale_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.sale_status AS ENUM (
    'draft',
    'awaiting_payment',
    'completed',
    'cancelled',
    'voided',
    'partially_refunded',
    'refunded'
);


ALTER TYPE public.sale_status OWNER TO asihjaya;

--
-- Name: settlement_import_row_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.settlement_import_row_status AS ENUM (
    'pending',
    'matched',
    'ambiguous',
    'mismatch',
    'not_found',
    'duplicate',
    'ignored',
    'applied',
    'failed'
);


ALTER TYPE public.settlement_import_row_status OWNER TO asihjaya;

--
-- Name: settlement_import_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.settlement_import_status AS ENUM (
    'uploaded',
    'ready',
    'processing',
    'completed',
    'completed_with_issues',
    'failed',
    'cancelled'
);


ALTER TYPE public.settlement_import_status OWNER TO asihjaya;

--
-- Name: shift_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.shift_status AS ENUM (
    'open',
    'closing',
    'closed'
);


ALTER TYPE public.shift_status OWNER TO asihjaya;

--
-- Name: user_status; Type: TYPE; Schema: public; Owner: asihjaya
--

CREATE TYPE public.user_status AS ENUM (
    'active',
    'inactive',
    'suspended'
);


ALTER TYPE public.user_status OWNER TO asihjaya;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: asihjaya
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO asihjaya;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: asihjaya
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNER TO asihjaya;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: asihjaya
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: approvals; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid,
    type public.approval_type NOT NULL,
    status public.approval_status DEFAULT 'pending'::public.approval_status NOT NULL,
    requested_by uuid NOT NULL,
    approved_by uuid,
    reference_type character varying(80),
    reference_id uuid,
    request_data jsonb NOT NULL,
    notes text,
    response_notes text,
    execution_status public.approval_execution_status DEFAULT 'not_started'::public.approval_execution_status NOT NULL,
    execution_idempotency_key character varying(160),
    execution_started_at timestamp with time zone,
    executed_at timestamp with time zone,
    executed_by uuid,
    execution_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT approvals_completed_state_ck CHECK (((execution_status <> 'completed'::public.approval_execution_status) OR ((executed_at IS NOT NULL) AND (executed_by IS NOT NULL)))),
    CONSTRAINT approvals_executing_state_ck CHECK (((execution_status <> 'executing'::public.approval_execution_status) OR (execution_started_at IS NOT NULL)))
);


ALTER TABLE public.approvals OWNER TO asihjaya;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid,
    actor_user_id uuid,
    action character varying(120) NOT NULL,
    entity_type character varying(120) NOT NULL,
    entity_id character varying(160),
    before_data jsonb,
    after_data jsonb,
    reason text,
    request_id character varying(120),
    ip_address character varying(64),
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO asihjaya;

--
-- Name: cash_movements; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.cash_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shift_id uuid NOT NULL,
    type public.cash_movement_type NOT NULL,
    amount numeric(18,0) NOT NULL,
    reference_type character varying(80),
    reference_id uuid,
    reason text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cash_movements_amount_ck CHECK ((((type = 'opening_balance'::public.cash_movement_type) AND (amount >= (0)::numeric)) OR ((type <> 'opening_balance'::public.cash_movement_type) AND (amount > (0)::numeric)))),
    CONSTRAINT cash_movements_system_reference_ck CHECK (((type <> ALL (ARRAY['opening_balance'::public.cash_movement_type, 'cash_sale'::public.cash_movement_type, 'cash_refund'::public.cash_movement_type])) OR ((reference_type IS NOT NULL) AND (reference_id IS NOT NULL))))
);


ALTER TABLE public.cash_movements OWNER TO asihjaya;

--
-- Name: customer_deposit_ledger; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.customer_deposit_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    sale_id uuid,
    payment_id uuid,
    cash_movement_id uuid,
    approval_id uuid,
    entry_type public.customer_deposit_ledger_entry_type NOT NULL,
    direction public.customer_deposit_ledger_direction NOT NULL,
    amount numeric(18,0) NOT NULL,
    balance_after numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    idempotency_key character varying(160),
    reference_type character varying(80),
    reference_id uuid,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_deposit_ledger_amount_positive_ck CHECK ((amount > (0)::numeric)),
    CONSTRAINT customer_deposit_ledger_balance_nonnegative_ck CHECK ((balance_after >= (0)::numeric)),
    CONSTRAINT customer_deposit_ledger_direction_ck CHECK ((((entry_type = 'deposit_in'::public.customer_deposit_ledger_entry_type) AND (direction = 'credit'::public.customer_deposit_ledger_direction)) OR ((entry_type = ANY (ARRAY['deposit_used'::public.customer_deposit_ledger_entry_type, 'deposit_withdrawal'::public.customer_deposit_ledger_entry_type])) AND (direction = 'debit'::public.customer_deposit_ledger_direction)) OR ((entry_type = 'adjustment'::public.customer_deposit_ledger_entry_type) AND (direction = ANY (ARRAY['credit'::public.customer_deposit_ledger_direction, 'debit'::public.customer_deposit_ledger_direction]))))),
    CONSTRAINT customer_deposit_ledger_reference_pair_ck CHECK ((((reference_type IS NULL) AND (reference_id IS NULL)) OR ((reference_type IS NOT NULL) AND (reference_id IS NOT NULL))))
);


ALTER TABLE public.customer_deposit_ledger OWNER TO asihjaya;

--
-- Name: customer_history_credentials; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.customer_history_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    pin_hash text NOT NULL,
    credential_version integer DEFAULT 1 NOT NULL,
    must_change_pin boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    failed_attempt_count integer DEFAULT 0 NOT NULL,
    failed_window_started_at timestamp with time zone,
    locked_until timestamp with time zone,
    pin_created_at timestamp with time zone DEFAULT now() NOT NULL,
    pin_reset_at timestamp with time zone,
    pin_created_by_user_id uuid,
    last_successful_access_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_history_credentials_failed_count_ck CHECK ((failed_attempt_count >= 0)),
    CONSTRAINT customer_history_credentials_version_ck CHECK ((credential_version > 0))
);


ALTER TABLE public.customer_history_credentials OWNER TO asihjaya;

--
-- Name: customer_history_ip_rate_limits; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.customer_history_ip_rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key_hash character varying(64) NOT NULL,
    window_started_at timestamp with time zone NOT NULL,
    failure_count integer DEFAULT 0 NOT NULL,
    blocked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_history_ip_rate_limits_failure_count_ck CHECK ((failure_count >= 0))
);


ALTER TABLE public.customer_history_ip_rate_limits OWNER TO asihjaya;

--
-- Name: customer_history_sessions; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.customer_history_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    credential_version integer NOT NULL,
    token_hash character varying(64) NOT NULL,
    requires_pin_change boolean DEFAULT false NOT NULL,
    absolute_expires_at timestamp with time zone NOT NULL,
    idle_expires_at timestamp with time zone NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    ip_address character varying(64),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_history_sessions_version_ck CHECK ((credential_version > 0))
);


ALTER TABLE public.customer_history_sessions OWNER TO asihjaya;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    customer_code character varying(64),
    full_name character varying(180) NOT NULL,
    phone character varying(32),
    email character varying(254),
    address text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customers OWNER TO asihjaya;

--
-- Name: hardware_agents; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.hardware_agents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    register_id uuid NOT NULL,
    code character varying(80) NOT NULL,
    name character varying(160) NOT NULL,
    secret_hash text NOT NULL,
    status public.hardware_agent_status DEFAULT 'offline'::public.hardware_agent_status NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    capabilities jsonb DEFAULT '{}'::jsonb,
    settings jsonb DEFAULT '{}'::jsonb,
    last_seen_at timestamp with time zone,
    last_ip_address character varying(64),
    last_user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.hardware_agents OWNER TO asihjaya;

--
-- Name: hardware_job_attempts; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.hardware_job_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    attempt_number integer NOT NULL,
    status public.hardware_job_attempt_status DEFAULT 'claimed'::public.hardware_job_attempt_status NOT NULL,
    lease_token_hash text NOT NULL,
    lease_expires_at timestamp with time zone NOT NULL,
    payload_hash character varying(64) NOT NULL,
    event_sequence integer DEFAULT 0 NOT NULL,
    dispatch_started_at timestamp with time zone,
    submitted_at timestamp with time zone,
    server_acknowledged_at timestamp with time zone,
    finished_at timestamp with time zone,
    error_code character varying(80),
    error_message text,
    retry_safe boolean,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hardware_job_attempts_event_sequence_ck CHECK ((event_sequence >= 0)),
    CONSTRAINT hardware_job_attempts_number_ck CHECK ((attempt_number > 0)),
    CONSTRAINT hardware_job_attempts_payload_hash_ck CHECK (((payload_hash)::text ~ '^[0-9a-f]{64}$'::text))
);


ALTER TABLE public.hardware_job_attempts OWNER TO asihjaya;

--
-- Name: hardware_job_resolutions; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.hardware_job_resolutions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    job_id uuid NOT NULL,
    attempt_id uuid,
    resolved_by_user_id uuid NOT NULL,
    resolution_type public.hardware_job_resolution_type NOT NULL,
    reason text NOT NULL,
    duplicate_risk_acknowledged boolean DEFAULT false NOT NULL,
    previous_status public.hardware_job_status NOT NULL,
    next_status public.hardware_job_status NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hardware_job_resolutions_reason_ck CHECK (((char_length(TRIM(BOTH FROM reason)) >= 12) AND (char_length(TRIM(BOTH FROM reason)) <= 500))),
    CONSTRAINT hardware_job_resolutions_retry_ack_ck CHECK (((resolution_type <> 'retry_authorized'::public.hardware_job_resolution_type) OR (duplicate_risk_acknowledged = true))),
    CONSTRAINT hardware_job_resolutions_status_ck CHECK (((previous_status = 'unknown_outcome'::public.hardware_job_status) AND (next_status = ANY (ARRAY['completed'::public.hardware_job_status, 'pending'::public.hardware_job_status, 'cancelled'::public.hardware_job_status]))))
);


ALTER TABLE public.hardware_job_resolutions OWNER TO asihjaya;

--
-- Name: hardware_jobs; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.hardware_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    register_id uuid NOT NULL,
    agent_id uuid,
    target_agent_id uuid,
    current_attempt_id uuid,
    created_by_user_id uuid,
    protocol_version integer DEFAULT 1 NOT NULL,
    job_type public.hardware_job_type NOT NULL,
    device_type public.hardware_device_type NOT NULL,
    required_capability character varying(80),
    target_device character varying(120),
    status public.hardware_job_status DEFAULT 'pending'::public.hardware_job_status NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    payload jsonb NOT NULL,
    payload_hash character varying(64),
    result jsonb DEFAULT '{}'::jsonb,
    error text,
    last_error_code character varying(80),
    last_error_message text,
    idempotency_key character varying(160),
    source_type character varying(80),
    source_id character varying(160),
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    claimed_at timestamp with time zone,
    started_at timestamp with time zone,
    processing_at timestamp with time zone,
    submitted_at timestamp with time zone,
    completed_at timestamp with time zone,
    failed_at timestamp with time zone,
    unknown_at timestamp with time zone,
    expired_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hardware_jobs_attempts_ck CHECK (((protocol_version <> 2) OR ((attempts >= 0) AND (max_attempts > 0) AND (attempts <= max_attempts)))),
    CONSTRAINT hardware_jobs_expiry_after_creation_ck CHECK (((expires_at IS NULL) OR (expires_at > created_at))),
    CONSTRAINT hardware_jobs_payload_hash_ck CHECK (((payload_hash IS NULL) OR ((payload_hash)::text ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT hardware_jobs_protocol_version_ck CHECK ((protocol_version = ANY (ARRAY[1, 2]))),
    CONSTRAINT hardware_jobs_required_capability_ck CHECK (((required_capability IS NULL) OR ((required_capability)::text = ANY ((ARRAY['print_label_sato'::character varying, 'print_document_pdf'::character varying, 'open_cash_drawer'::character varying])::text[])))),
    CONSTRAINT hardware_jobs_v2_required_fields_ck CHECK (((protocol_version <> 2) OR ((required_capability IS NOT NULL) AND (payload_hash IS NOT NULL) AND (expires_at IS NOT NULL) AND (idempotency_key IS NOT NULL)))),
    CONSTRAINT hardware_jobs_v2_status_ck CHECK (((protocol_version <> 2) OR (status <> 'printing'::public.hardware_job_status)))
);


ALTER TABLE public.hardware_jobs OWNER TO asihjaya;

--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    item_id uuid NOT NULL,
    movement_type public.inventory_movement_type NOT NULL,
    from_outlet_id uuid,
    to_outlet_id uuid,
    reference_type character varying(80),
    reference_id uuid,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    performed_by uuid NOT NULL,
    approved_by uuid,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.inventory_movements OWNER TO asihjaya;

--
-- Name: manual_payment_policies; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.manual_payment_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    method public.payment_method NOT NULL,
    co_verification_threshold numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    evidence_threshold numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    duplicate_lookback_days integer DEFAULT 30 NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT manual_payment_policies_lookback_ck CHECK (((duplicate_lookback_days >= 1) AND (duplicate_lookback_days <= 3650))),
    CONSTRAINT manual_payment_policies_method_ck CHECK ((method = ANY (ARRAY['qris_manual'::public.payment_method, 'debit_card'::public.payment_method, 'credit_card'::public.payment_method, 'bank_transfer'::public.payment_method]))),
    CONSTRAINT manual_payment_policies_thresholds_ck CHECK (((co_verification_threshold >= (0)::numeric) AND (evidence_threshold >= (0)::numeric)))
);


ALTER TABLE public.manual_payment_policies OWNER TO asihjaya;

--
-- Name: manual_payment_profiles; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.manual_payment_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    register_id uuid,
    profile_type character varying(24) NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(120) NOT NULL,
    provider character varying(80) NOT NULL,
    verification_source character varying(40) NOT NULL,
    merchant_id character varying(80),
    terminal_id character varying(80),
    destination_account character varying(120),
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT manual_payment_profiles_display_order_ck CHECK (((display_order >= 0) AND (display_order <= 9999))),
    CONSTRAINT manual_payment_profiles_fields_ck CHECK (((((profile_type)::text = 'qris'::text) AND ((verification_source)::text = ANY ((ARRAY['merchant_app'::character varying, 'bank_app'::character varying])::text[])) AND (merchant_id IS NOT NULL) AND (btrim((merchant_id)::text) <> ''::text)) OR (((profile_type)::text = 'edc'::text) AND ((verification_source)::text = 'edc_terminal'::text) AND (terminal_id IS NOT NULL) AND (btrim((terminal_id)::text) <> ''::text)) OR (((profile_type)::text = 'bank_account'::text) AND ((verification_source)::text = ANY ((ARRAY['bank_app'::character varying, 'bank_statement'::character varying])::text[])) AND (destination_account IS NOT NULL) AND (btrim((destination_account)::text) <> ''::text)))),
    CONSTRAINT manual_payment_profiles_source_ck CHECK (((verification_source)::text = ANY ((ARRAY['merchant_app'::character varying, 'edc_terminal'::character varying, 'bank_app'::character varying, 'bank_statement'::character varying])::text[]))),
    CONSTRAINT manual_payment_profiles_type_ck CHECK (((profile_type)::text = ANY ((ARRAY['qris'::character varying, 'edc'::character varying, 'bank_account'::character varying])::text[])))
);


ALTER TABLE public.manual_payment_profiles OWNER TO asihjaya;

--
-- Name: metal_price_rates; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.metal_price_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metal_purity_id uuid NOT NULL,
    rate_per_gram numeric(18,0) NOT NULL,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    effective_until timestamp with time zone,
    notes text,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT metal_price_rates_positive_ck CHECK ((rate_per_gram > (0)::numeric)),
    CONSTRAINT metal_price_rates_range_ck CHECK (((effective_until IS NULL) OR (effective_until > effective_from)))
);


ALTER TABLE public.metal_price_rates OWNER TO asihjaya;

--
-- Name: metal_purities; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.metal_purities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metal_id uuid NOT NULL,
    code character varying(32) NOT NULL,
    display_name character varying(80) NOT NULL,
    purity_percentage numeric(7,4) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT metal_purities_percentage_ck CHECK (((purity_percentage > (0)::numeric) AND (purity_percentage <= (100)::numeric)))
);


ALTER TABLE public.metal_purities OWNER TO asihjaya;

--
-- Name: metals; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.metals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    code character varying(32) NOT NULL,
    name character varying(80) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.metals OWNER TO asihjaya;

--
-- Name: notification_events; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.notification_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid,
    category public.notification_category NOT NULL,
    event_type character varying(120) NOT NULL,
    severity public.notification_severity DEFAULT 'info'::public.notification_severity NOT NULL,
    title character varying(160) NOT NULL,
    summary text NOT NULL,
    entity_type character varying(80),
    entity_id character varying(160),
    action_url character varying(300),
    requires_action boolean DEFAULT false NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    deduplication_key character varying(220),
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_events_action_url_ck CHECK (((action_url IS NULL) OR ("left"((action_url)::text, 1) = '/'::text))),
    CONSTRAINT notification_events_resolved_time_ck CHECK (((resolved_at IS NULL) OR (resolved_at >= occurred_at))),
    CONSTRAINT notification_events_title_summary_ck CHECK (((length(btrim((title)::text)) > 0) AND (length(btrim(summary)) > 0)))
);


ALTER TABLE public.notification_events OWNER TO asihjaya;

--
-- Name: notification_recipients; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.notification_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status public.notification_recipient_status DEFAULT 'unread'::public.notification_recipient_status NOT NULL,
    read_at timestamp with time zone,
    acknowledged_at timestamp with time zone,
    resolved_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_recipients_ack_time_ck CHECK (((status <> 'acknowledged'::public.notification_recipient_status) OR (acknowledged_at IS NOT NULL))),
    CONSTRAINT notification_recipients_archived_time_ck CHECK (((status <> 'archived'::public.notification_recipient_status) OR (archived_at IS NOT NULL))),
    CONSTRAINT notification_recipients_read_time_ck CHECK (((status <> 'read'::public.notification_recipient_status) OR (read_at IS NOT NULL))),
    CONSTRAINT notification_recipients_resolved_time_ck CHECK (((status <> 'resolved'::public.notification_recipient_status) OR (resolved_at IS NOT NULL)))
);


ALTER TABLE public.notification_recipients OWNER TO asihjaya;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid,
    user_id uuid,
    type public.notification_type NOT NULL,
    severity public.notification_severity DEFAULT 'info'::public.notification_severity NOT NULL,
    title character varying(160) NOT NULL,
    message text NOT NULL,
    entity_type character varying(80),
    entity_id character varying(160),
    action_url character varying(300),
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO asihjaya;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(160) NOT NULL,
    slug character varying(80) NOT NULL,
    timezone character varying(64) DEFAULT 'Asia/Jakarta'::character varying NOT NULL,
    currency character varying(3) DEFAULT 'IDR'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.organizations OWNER TO asihjaya;

--
-- Name: outlets; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.outlets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    code character varying(24) NOT NULL,
    name character varying(160) NOT NULL,
    address text,
    phone character varying(32),
    google_maps_embed_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.outlets OWNER TO asihjaya;

--
-- Name: payment_evidence_uploads; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.payment_evidence_uploads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    storage_key text NOT NULL,
    original_filename character varying(255),
    size_bytes integer NOT NULL,
    sale_id uuid,
    attached_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_evidence_uploads_attachment_ck CHECK ((((sale_id IS NULL) AND (attached_at IS NULL)) OR ((sale_id IS NOT NULL) AND (attached_at IS NOT NULL) AND (expires_at IS NULL)))),
    CONSTRAINT payment_evidence_uploads_size_ck CHECK ((size_bytes > 0))
);


ALTER TABLE public.payment_evidence_uploads OWNER TO asihjaya;

--
-- Name: payment_reconciliations; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.payment_reconciliations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    payment_id uuid NOT NULL,
    status public.payment_settlement_status NOT NULL,
    expected_amount numeric(18,0) NOT NULL,
    settlement_gross_amount numeric(18,0),
    fee_amount numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    tax_amount numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    net_settlement_amount numeric(18,0),
    difference_amount numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    settlement_date timestamp with time zone,
    settlement_reference character varying(160),
    evidence_key text,
    notes text,
    reconciled_by uuid NOT NULL,
    reconciled_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_reconciliations_actionable_status_ck CHECK ((status <> ALL (ARRAY['not_applicable'::public.payment_settlement_status, 'unreconciled'::public.payment_settlement_status]))),
    CONSTRAINT payment_reconciliations_amounts_nonnegative_ck CHECK (((fee_amount >= (0)::numeric) AND (tax_amount >= (0)::numeric) AND ((settlement_gross_amount IS NULL) OR (settlement_gross_amount >= (0)::numeric)) AND ((net_settlement_amount IS NULL) OR (net_settlement_amount >= (0)::numeric)))),
    CONSTRAINT payment_reconciliations_difference_formula_ck CHECK (((settlement_gross_amount IS NULL) OR (difference_amount = (settlement_gross_amount - expected_amount)))),
    CONSTRAINT payment_reconciliations_expected_positive_ck CHECK ((expected_amount > (0)::numeric)),
    CONSTRAINT payment_reconciliations_mismatch_complete_ck CHECK (((status <> 'mismatch'::public.payment_settlement_status) OR ((settlement_gross_amount IS NOT NULL) AND (difference_amount <> (0)::numeric)))),
    CONSTRAINT payment_reconciliations_net_formula_ck CHECK (((settlement_gross_amount IS NULL) OR (net_settlement_amount IS NULL) OR (net_settlement_amount = ((settlement_gross_amount - fee_amount) - tax_amount)))),
    CONSTRAINT payment_reconciliations_not_found_notes_ck CHECK (((status <> 'not_found'::public.payment_settlement_status) OR ((notes IS NOT NULL) AND (length(btrim(notes)) >= 8)))),
    CONSTRAINT payment_reconciliations_reconciled_complete_ck CHECK (((status <> 'reconciled'::public.payment_settlement_status) OR ((settlement_gross_amount = expected_amount) AND (difference_amount = (0)::numeric) AND (net_settlement_amount IS NOT NULL) AND (settlement_date IS NOT NULL) AND (settlement_reference IS NOT NULL) AND (btrim((settlement_reference)::text) <> ''::text)))),
    CONSTRAINT payment_reconciliations_waived_resolution_ck CHECK (((status <> 'waived'::public.payment_settlement_status) OR ((notes IS NOT NULL) AND (length(btrim(notes)) >= 8) AND (resolved_by IS NOT NULL) AND (resolved_at IS NOT NULL))))
);


ALTER TABLE public.payment_reconciliations OWNER TO asihjaya;

--
-- Name: payment_refunds; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.payment_refunds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    sale_id uuid NOT NULL,
    payment_id uuid NOT NULL,
    approval_id uuid,
    original_shift_id uuid NOT NULL,
    refund_shift_id uuid,
    amount numeric(18,0) NOT NULL,
    method public.payment_method NOT NULL,
    provider character varying(80) DEFAULT 'manual'::character varying NOT NULL,
    provider_reference character varying(160),
    destination_masked character varying(160),
    evidence_key text,
    reason text NOT NULL,
    status public.payment_refund_status DEFAULT 'requested'::public.payment_refund_status NOT NULL,
    idempotency_key character varying(160) NOT NULL,
    requested_by uuid NOT NULL,
    approved_by uuid,
    executed_by uuid,
    confirmed_by uuid,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    executed_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    failure_code character varying(120),
    failure_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_refunds_amount_positive_ck CHECK ((amount > (0)::numeric)),
    CONSTRAINT payment_refunds_cash_shift_ck CHECK (((NOT ((method = 'cash'::public.payment_method) AND (status = 'confirmed'::public.payment_refund_status))) OR (refund_shift_id IS NOT NULL))),
    CONSTRAINT payment_refunds_confirmed_state_ck CHECK (((status <> 'confirmed'::public.payment_refund_status) OR (confirmed_at IS NOT NULL)))
);


ALTER TABLE public.payment_refunds OWNER TO asihjaya;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    method public.payment_method NOT NULL,
    provider character varying(80) DEFAULT 'manual'::character varying NOT NULL,
    amount numeric(18,0) NOT NULL,
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    provider_reference character varying(160),
    normalized_reference character varying(160),
    external_order_id character varying(160),
    verification_status public.manual_payment_verification_status DEFAULT 'self_verified'::public.manual_payment_verification_status NOT NULL,
    verification_source character varying(40),
    provider_paid_at timestamp with time zone,
    verification_approval_id uuid,
    co_verified_by uuid,
    co_verified_at timestamp with time zone,
    evidence_key text,
    manual_payment_profile_id uuid,
    settlement_status public.payment_settlement_status DEFAULT 'not_applicable'::public.payment_settlement_status NOT NULL,
    verified_by uuid,
    verified_at timestamp with time zone,
    paid_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_positive_ck CHECK ((amount > (0)::numeric)),
    CONSTRAINT payments_cash_settlement_ck CHECK (((method <> 'cash'::public.payment_method) OR ((settlement_status = 'not_applicable'::public.payment_settlement_status) AND (verification_source IS NULL) AND (provider_paid_at IS NULL) AND (verification_approval_id IS NULL) AND (co_verified_by IS NULL) AND (co_verified_at IS NULL) AND (evidence_key IS NULL)))),
    CONSTRAINT payments_co_verified_state_ck CHECK (((verification_status <> 'co_verified'::public.manual_payment_verification_status) OR ((verification_approval_id IS NOT NULL) AND (co_verified_by IS NOT NULL) AND (co_verified_at IS NOT NULL)))),
    CONSTRAINT payments_manual_noncash_verification_ck CHECK (((method <> ALL (ARRAY['qris_manual'::public.payment_method, 'debit_card'::public.payment_method, 'credit_card'::public.payment_method, 'bank_transfer'::public.payment_method])) OR ((btrim((provider)::text) <> ''::text) AND (lower(btrim((provider)::text)) <> 'manual'::text) AND (provider_reference IS NOT NULL) AND (btrim((provider_reference)::text) <> ''::text) AND (normalized_reference IS NOT NULL) AND (length((normalized_reference)::text) >= 4) AND ((verification_source)::text = ANY ((ARRAY['merchant_app'::character varying, 'edc_terminal'::character varying, 'bank_app'::character varying, 'bank_statement'::character varying])::text[])) AND (provider_paid_at IS NOT NULL) AND (settlement_status <> 'not_applicable'::public.payment_settlement_status)))),
    CONSTRAINT payments_paid_state_complete_ck CHECK (((status <> 'paid'::public.payment_status) OR ((verified_by IS NOT NULL) AND (verified_at IS NOT NULL) AND (paid_at IS NOT NULL))))
);


ALTER TABLE public.payments OWNER TO asihjaya;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(120) NOT NULL,
    name character varying(160) NOT NULL,
    module character varying(80) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.permissions OWNER TO asihjaya;

--
-- Name: pos_checkout_attempts; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.pos_checkout_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    register_id uuid NOT NULL,
    shift_id uuid NOT NULL,
    cashier_id uuid NOT NULL,
    idempotency_key character varying(120) NOT NULL,
    request_fingerprint character varying(64) NOT NULL,
    status public.pos_checkout_attempt_status DEFAULT 'processing'::public.pos_checkout_attempt_status NOT NULL,
    sale_id uuid,
    attempt_count integer DEFAULT 1 NOT NULL,
    last_error_code character varying(80),
    last_error_message text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    failed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pos_checkout_attempts_attempt_count_positive_ck CHECK ((attempt_count > 0)),
    CONSTRAINT pos_checkout_attempts_completed_state_ck CHECK (((status <> 'completed'::public.pos_checkout_attempt_status) OR ((sale_id IS NOT NULL) AND (completed_at IS NOT NULL)))),
    CONSTRAINT pos_checkout_attempts_failed_state_ck CHECK (((status <> 'failed'::public.pos_checkout_attempt_status) OR (failed_at IS NOT NULL)))
);


ALTER TABLE public.pos_checkout_attempts OWNER TO asihjaya;

--
-- Name: pos_held_cart_items; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.pos_held_cart_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    held_cart_id uuid NOT NULL,
    product_item_id uuid NOT NULL,
    line_number bigint NOT NULL,
    list_price_amount numeric(18,0) NOT NULL,
    discount_amount numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    final_price_amount numeric(18,0) NOT NULL,
    snapshot jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    released_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pos_held_cart_items_discount_nonnegative_ck CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT pos_held_cart_items_final_price_nonnegative_ck CHECK ((final_price_amount >= (0)::numeric)),
    CONSTRAINT pos_held_cart_items_list_price_nonnegative_ck CHECK ((list_price_amount >= (0)::numeric))
);


ALTER TABLE public.pos_held_cart_items OWNER TO asihjaya;

--
-- Name: pos_held_carts; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.pos_held_carts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    register_id uuid NOT NULL,
    shift_id uuid NOT NULL,
    customer_id uuid,
    held_by_user_id uuid NOT NULL,
    hold_number character varying(80) NOT NULL,
    title character varying(160),
    note text,
    status public.pos_held_cart_status DEFAULT 'active'::public.pos_held_cart_status NOT NULL,
    item_count integer DEFAULT 0 NOT NULL,
    subtotal_amount numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    discount_amount numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    total_amount numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    resumed_at timestamp with time zone,
    resumed_by_user_id uuid,
    canceled_at timestamp with time zone,
    canceled_by_user_id uuid,
    cancel_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pos_held_carts_discount_nonnegative_ck CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT pos_held_carts_item_count_nonnegative_ck CHECK ((item_count >= 0)),
    CONSTRAINT pos_held_carts_subtotal_nonnegative_ck CHECK ((subtotal_amount >= (0)::numeric)),
    CONSTRAINT pos_held_carts_total_nonnegative_ck CHECK ((total_amount >= (0)::numeric))
);


ALTER TABLE public.pos_held_carts OWNER TO asihjaya;

--
-- Name: product_categories; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.product_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    parent_category_id uuid,
    code character varying(48) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    display_order integer DEFAULT 0 NOT NULL,
    attribute_schema jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_categories_no_self_parent_ck CHECK (((parent_category_id IS NULL) OR (parent_category_id <> id)))
);


ALTER TABLE public.product_categories OWNER TO asihjaya;

--
-- Name: product_item_number_seq; Type: SEQUENCE; Schema: public; Owner: asihjaya
--

CREATE SEQUENCE public.product_item_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_item_number_seq OWNER TO asihjaya;

--
-- Name: product_items; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.product_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    product_master_id uuid NOT NULL,
    display_name character varying(220),
    current_outlet_id uuid,
    sku character varying(80) NOT NULL,
    barcode character varying(120) NOT NULL,
    qr_value character varying(220),
    serial_number character varying(120),
    legacy_id character varying(120),
    legacy_url text,
    weight_gram numeric(12,3),
    purity_percent numeric(7,3),
    exchange_purity_percent numeric(7,3),
    size character varying(64),
    color character varying(64),
    gemstone character varying(160),
    cost_amount numeric(18,0),
    selling_amount numeric(18,0),
    price_per_gram numeric(18,0),
    deduction_per_gram numeric(18,0),
    availability public.item_availability DEFAULT 'draft'::public.item_availability NOT NULL,
    condition public.item_condition DEFAULT 'good'::public.item_condition NOT NULL,
    location_state public.item_location_state DEFAULT 'outlet'::public.item_location_state NOT NULL,
    location_code character varying(80),
    image_key text,
    attributes jsonb DEFAULT '{}'::jsonb,
    internal_notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_items_cost_nonnegative_ck CHECK (((cost_amount IS NULL) OR (cost_amount >= (0)::numeric))),
    CONSTRAINT product_items_deduction_nonnegative_ck CHECK (((deduction_per_gram IS NULL) OR (deduction_per_gram >= (0)::numeric))),
    CONSTRAINT product_items_price_per_gram_nonnegative_ck CHECK (((price_per_gram IS NULL) OR (price_per_gram >= (0)::numeric))),
    CONSTRAINT product_items_selling_positive_ck CHECK (((selling_amount IS NULL) OR (selling_amount > (0)::numeric))),
    CONSTRAINT product_items_weight_positive_ck CHECK (((weight_gram IS NULL) OR (weight_gram > (0)::numeric)))
);


ALTER TABLE public.product_items OWNER TO asihjaya;

--
-- Name: product_masters; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.product_masters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    category_id uuid NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(200) NOT NULL,
    brand character varying(120),
    material character varying(80),
    collection character varying(120),
    description text,
    image_key text,
    attributes jsonb DEFAULT '{}'::jsonb,
    status public.master_status DEFAULT 'draft'::public.master_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.product_masters OWNER TO asihjaya;

--
-- Name: registers; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.registers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    outlet_id uuid NOT NULL,
    code character varying(32) NOT NULL,
    name character varying(120) NOT NULL,
    is_hardware_hub boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.registers OWNER TO asihjaya;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    constraints jsonb
);


ALTER TABLE public.role_permissions OWNER TO asihjaya;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.roles OWNER TO asihjaya;

--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.sale_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    product_item_id uuid NOT NULL,
    line_number bigint NOT NULL,
    list_price_amount numeric(18,0) NOT NULL,
    discount_amount numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    final_price_amount numeric(18,0) NOT NULL,
    snapshot jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sale_items_discount_nonnegative_ck CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT sale_items_discount_not_above_list_ck CHECK ((discount_amount <= list_price_amount)),
    CONSTRAINT sale_items_final_price_formula_ck CHECK ((final_price_amount = (list_price_amount - discount_amount))),
    CONSTRAINT sale_items_list_price_positive_ck CHECK ((list_price_amount > (0)::numeric))
);


ALTER TABLE public.sale_items OWNER TO asihjaya;

--
-- Name: sale_return_cases; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.sale_return_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    sale_id uuid NOT NULL,
    approval_id uuid,
    status public.sale_return_case_status DEFAULT 'awaiting_receipt'::public.sale_return_case_status NOT NULL,
    expected_item_count integer NOT NULL,
    received_item_count integer DEFAULT 0 NOT NULL,
    inspected_item_count integer DEFAULT 0 NOT NULL,
    notes text,
    created_by uuid NOT NULL,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sale_return_cases_cancelled_state_ck CHECK (((status <> 'cancelled'::public.sale_return_case_status) OR (cancelled_at IS NOT NULL))),
    CONSTRAINT sale_return_cases_completed_state_ck CHECK (((status <> ALL (ARRAY['completed'::public.sale_return_case_status, 'rejected'::public.sale_return_case_status])) OR (completed_at IS NOT NULL))),
    CONSTRAINT sale_return_cases_counts_ck CHECK (((expected_item_count > 0) AND (received_item_count >= 0) AND (inspected_item_count >= 0) AND (received_item_count <= expected_item_count) AND (inspected_item_count <= received_item_count)))
);


ALTER TABLE public.sale_return_cases OWNER TO asihjaya;

--
-- Name: sale_return_items; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.sale_return_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    return_case_id uuid NOT NULL,
    sale_item_id uuid NOT NULL,
    product_item_id uuid NOT NULL,
    status public.sale_return_item_status DEFAULT 'awaiting_receipt'::public.sale_return_item_status NOT NULL,
    expected_sku character varying(80) NOT NULL,
    expected_barcode character varying(120) NOT NULL,
    expected_serial_number character varying(120),
    expected_weight_gram numeric(12,3),
    received_code character varying(160),
    actual_weight_gram numeric(12,3),
    identity_confirmed boolean,
    certificate_complete boolean,
    packaging_complete boolean,
    condition_good boolean,
    decision public.return_inspection_decision,
    inspection_notes text,
    photo_key text,
    received_by uuid,
    received_at timestamp with time zone,
    inspected_by uuid,
    inspected_at timestamp with time zone,
    decided_by uuid,
    decided_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sale_return_items_inspected_state_ck CHECK (((status = ANY (ARRAY['awaiting_receipt'::public.sale_return_item_status, 'pending_inspection'::public.sale_return_item_status])) OR ((inspected_by IS NOT NULL) AND (inspected_at IS NOT NULL) AND (decided_by IS NOT NULL) AND (decided_at IS NOT NULL) AND (decision IS NOT NULL)))),
    CONSTRAINT sale_return_items_received_state_ck CHECK (((status = 'awaiting_receipt'::public.sale_return_item_status) OR ((received_by IS NOT NULL) AND (received_at IS NOT NULL)))),
    CONSTRAINT sale_return_items_weight_positive_ck CHECK (((actual_weight_gram IS NULL) OR (actual_weight_gram > (0)::numeric)))
);


ALTER TABLE public.sale_return_items OWNER TO asihjaya;

--
-- Name: sales; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    register_id uuid NOT NULL,
    shift_id uuid NOT NULL,
    customer_id uuid,
    cashier_id uuid NOT NULL,
    invoice_number character varying(80) NOT NULL,
    idempotency_key character varying(120) NOT NULL,
    checkout_fingerprint character varying(64),
    status public.sale_status DEFAULT 'draft'::public.sale_status NOT NULL,
    subtotal_amount numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    discount_amount numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    discount_reason text,
    additional_fee_amount numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    total_amount numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_additional_fee_nonnegative_ck CHECK ((additional_fee_amount >= (0)::numeric)),
    CONSTRAINT sales_cancelled_timestamp_ck CHECK (((status <> ALL (ARRAY['cancelled'::public.sale_status, 'voided'::public.sale_status, 'refunded'::public.sale_status])) OR (cancelled_at IS NOT NULL))),
    CONSTRAINT sales_completed_timestamp_ck CHECK (((status <> 'completed'::public.sale_status) OR (completed_at IS NOT NULL))),
    CONSTRAINT sales_discount_nonnegative_ck CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT sales_discount_not_above_subtotal_ck CHECK ((discount_amount <= subtotal_amount)),
    CONSTRAINT sales_subtotal_nonnegative_ck CHECK ((subtotal_amount >= (0)::numeric)),
    CONSTRAINT sales_total_formula_ck CHECK ((total_amount = ((subtotal_amount - discount_amount) + additional_fee_amount))),
    CONSTRAINT sales_total_nonnegative_ck CHECK ((total_amount >= (0)::numeric))
);


ALTER TABLE public.sales OWNER TO asihjaya;

--
-- Name: settlement_import_batches; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.settlement_import_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_key text NOT NULL,
    file_hash character varying(64) NOT NULL,
    file_size_bytes integer NOT NULL,
    status public.settlement_import_status DEFAULT 'uploaded'::public.settlement_import_status NOT NULL,
    delimiter character varying(8) DEFAULT ','::character varying NOT NULL,
    headers jsonb DEFAULT '[]'::jsonb NOT NULL,
    column_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_count integer DEFAULT 0 NOT NULL,
    valid_row_count integer DEFAULT 0 NOT NULL,
    matched_count integer DEFAULT 0 NOT NULL,
    applied_count integer DEFAULT 0 NOT NULL,
    ambiguous_count integer DEFAULT 0 NOT NULL,
    mismatch_count integer DEFAULT 0 NOT NULL,
    not_found_count integer DEFAULT 0 NOT NULL,
    duplicate_count integer DEFAULT 0 NOT NULL,
    ignored_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    error_message text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT settlement_import_batches_counts_ck CHECK (((row_count >= 0) AND (valid_row_count >= 0) AND (matched_count >= 0) AND (applied_count >= 0) AND (ambiguous_count >= 0) AND (mismatch_count >= 0) AND (not_found_count >= 0) AND (duplicate_count >= 0) AND (ignored_count >= 0) AND (failed_count >= 0))),
    CONSTRAINT settlement_import_batches_file_size_ck CHECK (((file_size_bytes >= 1) AND (file_size_bytes <= 5242880)))
);


ALTER TABLE public.settlement_import_batches OWNER TO asihjaya;

--
-- Name: settlement_import_mappings; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.settlement_import_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    delimiter character varying(8) DEFAULT ','::character varying NOT NULL,
    column_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT settlement_import_mappings_delimiter_ck CHECK (((length((delimiter)::text) >= 1) AND (length((delimiter)::text) <= 8)))
);


ALTER TABLE public.settlement_import_mappings OWNER TO asihjaya;

--
-- Name: settlement_import_rows; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.settlement_import_rows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    row_number integer NOT NULL,
    raw_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    transaction_date timestamp with time zone,
    payment_reference character varying(160),
    normalized_reference character varying(160),
    gross_amount numeric(18,0),
    fee_amount numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    tax_amount numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    net_amount numeric(18,0),
    settlement_reference character varying(160),
    provider_status character varying(80),
    status public.settlement_import_row_status DEFAULT 'pending'::public.settlement_import_row_status NOT NULL,
    matched_payment_id uuid,
    candidate_payment_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    match_reason text,
    error_message text,
    review_notes text,
    applied_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT settlement_import_rows_amounts_ck CHECK ((((gross_amount IS NULL) OR (gross_amount >= (0)::numeric)) AND (fee_amount >= (0)::numeric) AND (tax_amount >= (0)::numeric) AND ((net_amount IS NULL) OR (net_amount >= (0)::numeric)))),
    CONSTRAINT settlement_import_rows_applied_ck CHECK (((status <> 'applied'::public.settlement_import_row_status) OR ((matched_payment_id IS NOT NULL) AND (applied_at IS NOT NULL)))),
    CONSTRAINT settlement_import_rows_row_number_ck CHECK ((row_number > 1))
);


ALTER TABLE public.settlement_import_rows OWNER TO asihjaya;

--
-- Name: shifts; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    outlet_id uuid NOT NULL,
    register_id uuid NOT NULL,
    opened_by uuid NOT NULL,
    closed_by uuid,
    status public.shift_status DEFAULT 'open'::public.shift_status NOT NULL,
    opening_cash numeric(18,0) DEFAULT '0'::numeric NOT NULL,
    expected_cash numeric(18,0),
    actual_cash numeric(18,0),
    cash_variance numeric(18,0),
    variance_reason text,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shifts_actual_cash_nonnegative_ck CHECK (((actual_cash IS NULL) OR (actual_cash >= (0)::numeric))),
    CONSTRAINT shifts_closed_state_complete_ck CHECK (((status <> 'closed'::public.shift_status) OR ((closed_by IS NOT NULL) AND (expected_cash IS NOT NULL) AND (actual_cash IS NOT NULL) AND (cash_variance IS NOT NULL) AND (closed_at IS NOT NULL)))),
    CONSTRAINT shifts_opening_cash_nonnegative_ck CHECK ((opening_cash >= (0)::numeric))
);


ALTER TABLE public.shifts OWNER TO asihjaya;

--
-- Name: user_outlets; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.user_outlets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL
);


ALTER TABLE public.user_outlets OWNER TO asihjaya;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid
);


ALTER TABLE public.user_roles OWNER TO asihjaya;

--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    ip_address character varying(64),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_sessions OWNER TO asihjaya;

--
-- Name: users; Type: TABLE; Schema: public; Owner: asihjaya
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    email character varying(254) NOT NULL,
    username character varying(80) NOT NULL,
    full_name character varying(160) NOT NULL,
    phone character varying(32),
    password_hash text,
    status public.user_status DEFAULT 'active'::public.user_status NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO asihjaya;

--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: asihjaya
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: asihjaya
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
1	dd4448a531310e85db1a7926cd740873fba2365db80b6ea127d895d4abde3a27	1784744319447
2	0f4ac72ada7cae24eca17048840f31748b034ef3c669afdd6130a3edb0551baa	1784791496019
3	c7a63859795c2d52dd7909f0bab10baf5c393d101b8958f1598fc6ff7872f488	1785126743803
\.


--
-- Data for Name: approvals; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.approvals (id, organization_id, outlet_id, type, status, requested_by, approved_by, reference_type, reference_id, request_data, notes, response_notes, execution_status, execution_idempotency_key, execution_started_at, executed_at, executed_by, execution_error, created_at, resolved_at) FROM stdin;
95f9bede-076c-4e2e-99a3-0c64af51849a	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	customer_deposit_withdrawal	rejected	840c182b-642d-438d-b6ee-24f1e56833a3	09bf466f-0533-402a-8175-f12c05fbe101	customer	da5c8f1c-9d23-4085-ad57-f2d1cbed9fec	{"reason": "Customer meminta dana titip 50ribu", "source": "admin.customer.detail", "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "customerId": "da5c8f1c-9d23-4085-ad57-f2d1cbed9fec", "outletCode": "TOKO-BG", "outletName": "Bantar Gebang", "flowVersion": "p4.5-a", "requestedAt": "2026-07-23T18:31:24.930Z", "requesterId": "840c182b-642d-438d-b6ee-24f1e56833a3", "customerCode": "CUST-20260723-04F7E805", "customerName": "Siti Aminah", "balanceBefore": 150000, "customerPhone": "081234567868", "depositAmount": 50000, "requesterName": "System Administrator", "executionStage": "awaiting_approval", "withdrawalAmount": 50000, "executionRequired": true, "balanceAfterIfApproved": 100000}	Customer meminta dana titip 50ribu	Maaf tidak bisa tarik dana titipan untuk saat ini	cancelled	\N	\N	\N	\N	\N	2026-07-23 18:31:24.93+00	2026-07-23 18:37:42.226+00
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.audit_logs (id, organization_id, outlet_id, actor_user_id, action, entity_type, entity_id, before_data, after_data, reason, request_id, ip_address, user_agent, metadata, created_at) FROM stdin;
64cbbcab-e74b-407b-b7c6-40093b3fb0e9	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	auth.login	user	840c182b-642d-438d-b6ee-24f1e56833a3	\N	{"method": "password"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-22 18:24:36.512329+00
cf0e856c-e9fd-4c00-9ae3-09531985f88b	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	shift.open	shift	3d4da573-4f97-4d7d-818d-69d53de29e24	\N	{"note": "Hanita: Shift pagi bantar gebang", "shiftId": "3d4da573-4f97-4d7d-818d-69d53de29e24", "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "registerId": "36961177-52d1-45e7-ba0c-d1bf785ce2da", "openingCash": "500000", "registerCode": "POS-BG1", "registerName": "Kasir Bantar Gebang 1"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"source": "pos.open_shift"}	2026-07-22 18:33:44.803277+00
962feb3a-9973-48f7-a33c-16e37cb896f9	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	outlet.update	outlet	6eabe9d2-5b95-46c6-802b-f229e895bc9a	{"code": "TOKO-BG", "name": "Bantar Gebang", "phone": null, "address": null, "isActive": true, "googleMapsEmbedUrl": null}	{"code": "TOKO-BG", "name": "Bantar Gebang", "phone": "081234567868", "address": "Jl. Belakang Ps. Bantar Gebang, RT.003/RW.009, Bantargebang, Kec. Bantar Gebang, Kota Bks, Jawa Barat 17151", "isActive": true, "googleMapsEmbedUrl": "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3965.6233410898444!2d106.9880168!3d-6.3131108000000005!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69930059978a21%3A0x257754d7d88995d2!2sToko%20Emas%20Asih%20Jaya%20Bantar%20Gebang!5e0!3m2!1sen!2sid!4v1784745310463!5m2!1sen!2sid"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-22 18:35:36.528043+00
229d6881-113e-4751-8b8e-88a6cda342eb	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	register.update	register	36961177-52d1-45e7-ba0c-d1bf785ce2da	{"code": "POS-BG1", "name": "Kasir Bantar Gebang 1", "isActive": true, "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "isHardwareHub": true}	{"code": "POS-BG1", "name": "Kasir Bantar Gebang 1", "isActive": true, "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "isHardwareHub": true, "replacedHardwareHub": null}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-22 18:35:54.743701+00
8e583cd8-2d28-4261-8841-dd39022ddfd8	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	customer.create	customer	da5c8f1c-9d23-4085-ad57-f2d1cbed9fec	\N	{"email": "sitiaminah87@gmail.com", "notes": "suka model simple, dan dia selalu respon follow-up di WA setiap hari minggu sore hari", "phone": "081234567868", "address": "Jl.Salemba Utan Barat, Matraman - Jakarta Timur", "fullName": "Siti Aminah", "isActive": true, "customerId": "da5c8f1c-9d23-4085-ad57-f2d1cbed9fec", "customerCode": "CUST-20260723-04F7E805"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"source": "admin.customers.create"}	2026-07-22 18:48:45.856342+00
dd8dc734-a423-4f41-a197-7f8025e4091e	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	product_master.create	product_master	2fcd87b7-2654-4a9f-a1f7-1f187c34bac7	\N	{"code": "RING-AURELIA", "name": "Cincin Solitaire Aurelia", "brand": "ASIHJAYA", "status": "active", "imageKey": "organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/products/2fcd87b7-2654-4a9f-a1f7-1f187c34bac7/c97a3275-2e93-4dda-acaa-c3a070de4fe6.webp", "categoryId": "d946ca88-6c6f-4c5b-a0c3-13a30c55ab28", "collection": "Aurelia", "description": null, "categoryCode": "RING", "categoryName": "Cincin"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-22 18:49:33.916117+00
9de2c1d7-c102-4474-94f9-de52a8e05069	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	product_item.create	product_item	55106de5-7d80-49ef-924b-602241c445e3	\N	{"sku": "AJ-ITEM-00000001", "size": "10", "color": "Poles", "barcode": "AJ00000001", "qrValue": "AJ00000001", "gemstone": "Tanpa Batu", "imageKey": "organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/items/55106de5-7d80-49ef-924b-602241c445e3/91a868f7-8678-4912-aefc-e7c2e64ee180.webp", "condition": "good", "costAmount": "970000", "outletCode": "TOKO-BG", "outletName": "Bantar Gebang", "weightGram": "2.750", "displayName": "Aurelia Gold Ring", "productCode": "RING-AURELIA", "productName": "Cincin Solitaire Aurelia", "availability": "available", "locationCode": "ETALASE-A-01", "pricePerGram": "875000", "purityPercent": "35.2", "sellingAmount": "1450000", "currentOutletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "productMasterId": "2fcd87b7-2654-4a9f-a1f7-1f187c34bac7", "deductionPerGram": "125000", "exchangePurityPercent": "11", "pricingManagedByActor": true}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-22 18:50:41.881296+00
ed43c14a-8586-4a86-91f5-7d53d4bfae9a	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	product_item.create	product_item	2aab6804-23c0-435b-8b4d-495700a86365	\N	{"sku": "AJ-ITEM-00000002", "size": "8", "color": "Poles", "barcode": "AJ00000002", "qrValue": "AJ00000002", "gemstone": "Berlian", "imageKey": "organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/items/2aab6804-23c0-435b-8b4d-495700a86365/1badbfe9-47f0-4d67-a490-e048406b97f9.webp", "condition": "good", "costAmount": "1550000", "outletCode": "TOKO-BG", "outletName": "Bantar Gebang", "weightGram": "1.250", "displayName": "Aurelia Amethyst Ring", "productCode": "RING-AURELIA", "productName": "Cincin Solitaire Aurelia", "availability": "available", "locationCode": "ETALASE-A-02", "pricePerGram": "1450000", "purityPercent": "35.2", "sellingAmount": "1812500", "currentOutletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "productMasterId": "2fcd87b7-2654-4a9f-a1f7-1f187c34bac7", "deductionPerGram": "150000", "exchangePurityPercent": "11", "pricingManagedByActor": true}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-22 18:52:41.649001+00
ea2b9e1c-21be-4d43-90ac-833c334dff88	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	product_master.create	product_master	0bdd002c-78a4-41fe-944c-97fe439a7fa6	\N	{"code": "WEDDING-BRACELET", "name": "Gelang Solitaire Aurelia", "brand": "ASIHJAYA", "status": "active", "imageKey": "organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/products/0bdd002c-78a4-41fe-944c-97fe439a7fa6/163f16ea-e45e-4a65-b116-30098a7278ca.webp", "categoryId": "9cd8892b-39ce-4903-b1ca-fd6c8be89a84", "collection": "Wedding", "description": null, "categoryCode": "BRACELET", "categoryName": "Gelang"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-22 18:54:07.674932+00
b67df4f9-eead-4266-a4bf-59e6d0b940e0	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	staff.create	user	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	\N	{"email": "anindita@asihjaya.local", "phone": "081234567891", "status": "active", "roleIds": ["c4175cc4-aa06-4364-bee9-66d84cc6f13c"], "fullName": "Anindita Silva", "username": "anindita", "outletIds": ["6eabe9d2-5b95-46c6-802b-f229e895bc9a"], "primaryOutletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-22 18:58:35.267382+00
68ac3984-b60f-4f31-bd3d-3e93fe7731a8	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	auth.login	user	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	\N	{"method": "password"}	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	{}	2026-07-22 19:00:01.202392+00
6618591a-5b44-45cc-aa50-14ebcd5d8857	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	product_item.create	product_item	4a633615-c71d-4221-a6e9-43f31a87c433	\N	{"sku": "AJ-ITEM-00000003", "size": "10", "color": "Kuning", "barcode": "AJ00000003", "qrValue": "AJ00000003", "gemstone": "Berlian", "imageKey": "organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/items/4a633615-c71d-4221-a6e9-43f31a87c433/ce533bda-5f30-4267-90a1-16f322290c6c.webp", "condition": "good", "costAmount": "870000", "outletCode": "TOKO-BG", "outletName": "Bantar Gebang", "weightGram": "1.650", "displayName": "Gelang Solitare Aurelia", "productCode": "WEDDING-BRACELET", "productName": "Gelang Solitaire Aurelia", "availability": "available", "locationCode": "ETALASE-B-01", "pricePerGram": "780000", "purityPercent": "65.8", "sellingAmount": "1287000", "currentOutletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "productMasterId": "0bdd002c-78a4-41fe-944c-97fe439a7fa6", "deductionPerGram": "145000", "exchangePurityPercent": "11", "pricingManagedByActor": true}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-22 18:55:15.348528+00
2a0aaa99-83ba-42bf-9af6-8a441db62d5d	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	product_item.create	product_item	3d288805-cfce-40cb-baa7-83ec95d48219	\N	{"sku": "AJ-ITEM-00000004", "size": "12", "color": "Kuning", "barcode": "AJ00000004", "qrValue": "AJ00000004", "gemstone": "Berlian", "imageKey": "organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/items/3d288805-cfce-40cb-baa7-83ec95d48219/238f71b6-d378-42dd-a648-a24eb46b586c.webp", "condition": "good", "costAmount": "800000", "outletCode": "TOKO-BG", "outletName": "Bantar Gebang", "weightGram": "2.750", "displayName": "Gelang Wedding Amara", "productCode": "WEDDING-BRACELET", "productName": "Gelang Solitaire Aurelia", "availability": "available", "locationCode": "ETALASE-B-02", "pricePerGram": "750000", "purityPercent": "18.5", "sellingAmount": "2062500", "currentOutletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "productMasterId": "0bdd002c-78a4-41fe-944c-97fe439a7fa6", "deductionPerGram": "55000", "exchangePurityPercent": "32", "pricingManagedByActor": true}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-22 18:57:24.720048+00
a6297e93-2dbc-4990-9c66-793933b146ee	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	register.create	register	066908eb-8d08-4676-a136-197b9af1a7fc	\N	{"code": "POS-02", "name": "POS Sales", "isActive": true, "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "isHardwareHub": true, "replacedHardwareHub": {"id": "36961177-52d1-45e7-ba0c-d1bf785ce2da", "code": "POS-BG1", "name": "Kasir Bantar Gebang 1"}}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-22 18:59:25.40819+00
801ff655-4e71-4314-95ac-e66b258ae052	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	shift.open	shift	12a39630-334f-4567-a906-55daa8829c94	\N	{"note": "Hanita: Shift pagi bantar gebang", "shiftId": "12a39630-334f-4567-a906-55daa8829c94", "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "registerId": "066908eb-8d08-4676-a136-197b9af1a7fc", "openingCash": "650000", "registerCode": "POS-02", "registerName": "POS Sales"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"source": "pos.open_shift"}	2026-07-22 19:00:24.784946+00
8cad301c-edb9-4df8-bb61-a9b9114ac71b	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	sale.completed	sale	b811bd6a-1e1a-4b1f-b3d3-738564db1116	\N	{"saleId": "b811bd6a-1e1a-4b1f-b3d3-738564db1116", "shiftId": "12a39630-334f-4567-a906-55daa8829c94", "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "payments": [{"amount": "1287000", "method": "cash", "provider": null, "reference": null, "changeAmount": 0}], "cashierId": "1e2b1d29-e48c-43a6-b7ab-8fa0761f2524", "itemCount": 1, "customerId": "da5c8f1c-9d23-4085-ad57-f2d1cbed9fec", "outletCode": "TOKO-BG", "registerId": "066908eb-8d08-4676-a136-197b9af1a7fc", "totalAmount": "1287000", "customerCode": "CUST-20260723-04F7E805", "customerName": "Siti Aminah", "registerCode": "POS-02", "invoiceNumber": "AJ-TOKO-BG-20260723-8D52349C", "discountAmount": "0", "discountReason": null, "subtotalAmount": "1287000", "discountApprovalId": null}	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	{"source": "pos.checkout", "customerId": "da5c8f1c-9d23-4085-ad57-f2d1cbed9fec", "idempotencyKey": "pos_3af1013e-3a4f-4e43-9b41-719abcc492e9", "discountApprovalId": null}	2026-07-22 19:01:12.762+00
2c9312a6-42a0-4902-822e-339eb1a926cb	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	hardware.job_created	hardware_job	2f2f73fd-aa06-4be9-b941-455f01d6cca4	\N	{"status": "pending", "jobType": "print_receipt_certificate", "sourceId": "b811bd6a-1e1a-4b1f-b3d3-738564db1116", "expiresAt": "2026-07-22T23:01:12.762Z", "sourceType": "sale", "targetAgentId": null, "protocolVersion": 2, "requiredCapability": "print_document_pdf"}	\N	pos_3af1013e-3a4f-4e43-9b41-719abcc492e9	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	{"source": "pos.checkout", "payloadHash": "5fefc10c9da9b64d112b5b7f25d92eb0489531399b9c736f84cf15e55c6fa4f2", "creationMode": "automatic", "idempotencyKey": "receipt:b811bd6a-1e1a-4b1f-b3d3-738564db1116:initial"}	2026-07-22 19:01:12.762+00
d4487f5b-b457-490a-a12d-6596b161dffd	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	outlet.update	outlet	6eabe9d2-5b95-46c6-802b-f229e895bc9a	{"code": "TOKO-BG", "name": "Bantar Gebang", "phone": "081234567868", "address": "Jl. Belakang Ps. Bantar Gebang, RT.003/RW.009, Bantargebang, Kec. Bantar Gebang, Kota Bks, Jawa Barat 17151", "isActive": true, "googleMapsEmbedUrl": "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3965.6233410898444!2d106.9880168!3d-6.3131108000000005!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69930059978a21%3A0x257754d7d88995d2!2sToko%20Emas%20Asih%20Jaya%20Bantar%20Gebang!5e0!3m2!1sen!2sid!4v1784745310463!5m2!1sen!2sid"}	{"code": "TOKO-BG", "name": "Bantar Gebang", "phone": "081234567868", "address": "Jl. Belakang Ps. Bantar Gebang, RT.003/RW.009, Bantargebang, Kec. Bantar Gebang, Kota Bks, Jawa Barat 17151", "isActive": true, "googleMapsEmbedUrl": "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3965.6233410898444!2d106.9880168!3d-6.3131108000000005!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69930059978a21%3A0x257754d7d88995d2!2sToko%20Emas%20Asih%20Jaya%20Bantar%20Gebang!5e0!3m2!1sen!2sid!4v1784745310463!5m2!1sen!2sid"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-22 19:02:08.921175+00
59aecf4a-2199-4d27-906d-5850ac7baa00	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	auth.logout	user_session	c26da452-3bea-442f-8965-7c4b1da865a6	\N	\N	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	{}	2026-07-22 19:07:51.353172+00
0e1e945f-b0c0-4fd9-9f52-66442c81d465	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	auth.login	user	840c182b-642d-438d-b6ee-24f1e56833a3	\N	{"method": "password"}	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	{}	2026-07-22 19:07:53.090677+00
8913f2cf-ec58-46fd-a900-06115767f94a	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	auth.logout	user_session	e67e9de0-84f8-416f-ab94-e49e301548fc	\N	\N	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	{}	2026-07-22 19:08:04.784197+00
89a07983-0dd8-4407-a224-daafeed29606	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	auth.login	user	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	\N	{"method": "password"}	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	{}	2026-07-22 19:08:09.792124+00
5033d988-95e5-4603-887b-6ce4275a770e	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	hardware.job_cancelled	hardware_job	2f2f73fd-aa06-4be9-b941-455f01d6cca4	{"status": "pending"}	{"status": "cancelled"}	Dibatalkan manual dari dashboard Hardware Hub.	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"jobType": "print_receipt_certificate", "protocolVersion": 2}	2026-07-22 19:08:27.911784+00
ece381ed-bfd9-434d-b98e-a0792bce810b	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	register.update	register	36961177-52d1-45e7-ba0c-d1bf785ce2da	{"code": "POS-BG1", "name": "Kasir Bantar Gebang 1", "isActive": true, "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "isHardwareHub": false}	{"code": "POS-BG1", "name": "Kasir Bantar Gebang 1", "isActive": true, "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "isHardwareHub": false, "replacedHardwareHub": null}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-22 19:09:08.572004+00
fae0e2ea-d3f1-4bc1-bff4-6084dac9eaa7	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	shift.close	shift	12a39630-334f-4567-a906-55daa8829c94	{"status": "open", "expectedCash": "1937000"}	{"status": "closed", "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "actualCash": "1937000", "outletCode": "TOKO-BG", "outletName": "Bantar Gebang", "registerId": "066908eb-8d08-4676-a136-197b9af1a7fc", "cashSummary": {"cashIn": 0, "cashOut": 0, "cashSales": 1287000, "cashRefunds": 0, "expectedCash": 1937000, "movementCount": 2, "openingBalance": 650000, "closingAdjustments": 0}, "openingCash": "650000", "cashVariance": "0", "expectedCash": "1937000", "registerCode": "POS-02", "registerName": "POS Sales", "varianceReason": null}	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	{"source": "pos.close_shift", "closedAt": "2026-07-22T19:09:35.838Z"}	2026-07-22 19:09:35.838+00
65472bf8-4245-4768-a648-504590c4e94a	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	shift.open	shift	a0af43ba-c501-4f7b-987b-f71ca958c5cb	\N	{"note": "Shift pagi outlet bantar gebang", "shiftId": "a0af43ba-c501-4f7b-987b-f71ca958c5cb", "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "registerId": "066908eb-8d08-4676-a136-197b9af1a7fc", "openingCash": "500000", "registerCode": "POS-02", "registerName": "POS Sales"}	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	{"source": "pos.open_shift"}	2026-07-22 19:11:47.812136+00
e7015c80-cb10-4a84-86ca-1aa4f09b8019	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	register.update	register	066908eb-8d08-4676-a136-197b9af1a7fc	{"code": "POS-02", "name": "POS Sales", "isActive": true, "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "isHardwareHub": true}	{"code": "POS-02", "name": "POS Sales", "isActive": true, "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "isHardwareHub": false, "replacedHardwareHub": null}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-22 19:14:15.369395+00
cfe198bf-6d4d-4b75-8d0a-89be8837e310	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	register.update	register	36961177-52d1-45e7-ba0c-d1bf785ce2da	{"code": "POS-BG1", "name": "Kasir Bantar Gebang 1", "isActive": true, "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "isHardwareHub": false}	{"code": "POS-BG1", "name": "Kasir Bantar Gebang 1", "isActive": true, "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "isHardwareHub": true, "replacedHardwareHub": null}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-22 19:14:24.679374+00
519b01cc-14d1-43fa-af51-673fa5d957e6	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	hardware.job_created	hardware_job	e7194c28-34dd-4545-89f7-b90faf7411af	\N	{"status": "pending", "jobType": "test_document_printer", "sourceId": "83f767eb-284a-4591-9a5f-1853ade35eae", "expiresAt": "2026-07-22T23:00:14.508Z", "sourceType": "hardware_test", "targetAgentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "protocolVersion": 2, "requiredCapability": "print_document_pdf"}	Menjalankan test document printer untuk agent TOKO-BG1.	83f767eb-284a-4591-9a5f-1853ade35eae	\N	\N	{"source": "admin.hardware_dashboard", "payloadHash": "bcaad165658891ae40be5eb86116e840795bb43a3b1a1044b067659e58294575", "creationMode": "test", "idempotencyKey": "hardware-test:83f767eb-284a-4591-9a5f-1853ade35eae"}	2026-07-22 22:58:14.508+00
267a1a5c-576d-4933-80ea-2fccc01a518c	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_dispatch_started	hardware_job	e7194c28-34dd-4545-89f7-b90faf7411af	{"jobStatus": "processing", "attemptStatus": "processing", "eventSequence": 1}	{"jobStatus": "processing", "disposition": "updated", "attemptStatus": "dispatching", "eventSequence": 2}	\N	c69afe97-223e-43c4-b523-fdae43d98445:dispatching:2	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "test_document_printer", "attemptId": "c69afe97-223e-43c4-b523-fdae43d98445", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-22T22:58:22.032Z", "protocolVersion": 2}	2026-07-22 22:58:23.396234+00
ce4990eb-036d-4998-ade8-e5711bf8754e	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_submitted	hardware_job	e7194c28-34dd-4545-89f7-b90faf7411af	{"jobStatus": "processing", "attemptStatus": "dispatching", "eventSequence": 2}	{"jobStatus": "submitted", "disposition": "updated", "attemptStatus": "submitted", "eventSequence": 3}	\N	c69afe97-223e-43c4-b523-fdae43d98445:submitted:3	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "test_document_printer", "attemptId": "c69afe97-223e-43c4-b523-fdae43d98445", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-22T22:58:23.414Z", "protocolVersion": 2}	2026-07-22 22:58:24.969201+00
a3d4bae9-6f02-414f-a07d-907e42674dab	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_completed	hardware_job	e7194c28-34dd-4545-89f7-b90faf7411af	{"jobStatus": "submitted", "attemptStatus": "submitted", "eventSequence": 3}	{"jobStatus": "completed", "disposition": "updated", "attemptStatus": "acknowledged", "eventSequence": 4}	\N	c69afe97-223e-43c4-b523-fdae43d98445:acknowledged:4	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "test_document_printer", "attemptId": "c69afe97-223e-43c4-b523-fdae43d98445", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-22T22:58:24.982Z", "protocolVersion": 2}	2026-07-22 22:58:26.400163+00
9ac6ef56-a0cc-4b97-be2f-9f202fe1fd91	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	sale.completed	sale	a05177cf-aa7d-4258-8526-fb36c838dc50	\N	{"saleId": "a05177cf-aa7d-4258-8526-fb36c838dc50", "shiftId": "3d4da573-4f97-4d7d-818d-69d53de29e24", "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "payments": [{"amount": "1812500", "method": "cash", "provider": null, "reference": null, "changeAmount": 0}], "cashierId": "840c182b-642d-438d-b6ee-24f1e56833a3", "itemCount": 1, "customerId": "da5c8f1c-9d23-4085-ad57-f2d1cbed9fec", "outletCode": "TOKO-BG", "registerId": "36961177-52d1-45e7-ba0c-d1bf785ce2da", "totalAmount": "1812500", "customerCode": "CUST-20260723-04F7E805", "customerName": "Siti Aminah", "registerCode": "POS-BG1", "invoiceNumber": "AJ-TOKO-BG-20260723-755DB604", "discountAmount": "0", "discountReason": null, "subtotalAmount": "1812500", "discountApprovalId": null}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"source": "pos.checkout", "customerId": "da5c8f1c-9d23-4085-ad57-f2d1cbed9fec", "idempotencyKey": "pos_0b956cf1-10f6-410f-865a-44892f11030a", "discountApprovalId": null}	2026-07-22 23:17:50.666+00
4011ef4a-c1b3-41b0-9548-1594d445b5c5	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	hardware.job_created	hardware_job	e7c922fc-37ed-4431-b70c-0ab3bc7a41fd	\N	{"status": "pending", "jobType": "print_receipt_certificate", "sourceId": "a05177cf-aa7d-4258-8526-fb36c838dc50", "expiresAt": "2026-07-23T03:17:50.666Z", "sourceType": "sale", "targetAgentId": null, "protocolVersion": 2, "requiredCapability": "print_document_pdf"}	\N	pos_0b956cf1-10f6-410f-865a-44892f11030a	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"source": "pos.checkout", "payloadHash": "003475b926c0fc778c2ea654246eae6e348ca07e093145c67d3973a4ddbcb8a6", "creationMode": "automatic", "idempotencyKey": "receipt:a05177cf-aa7d-4258-8526-fb36c838dc50:initial"}	2026-07-22 23:17:50.666+00
629610ac-0299-4072-a9be-05f4e589c70e	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	shift.close	shift	3d4da573-4f97-4d7d-818d-69d53de29e24	{"status": "open", "expectedCash": "2312500"}	{"status": "closed", "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "actualCash": "2312500", "outletCode": "TOKO-BG", "outletName": "Bantar Gebang", "registerId": "36961177-52d1-45e7-ba0c-d1bf785ce2da", "cashSummary": {"cashIn": 0, "cashOut": 0, "cashSales": 1812500, "cashRefunds": 0, "expectedCash": 2312500, "movementCount": 2, "openingBalance": 500000, "closingAdjustments": 0}, "openingCash": "500000", "cashVariance": "0", "expectedCash": "2312500", "registerCode": "POS-BG1", "registerName": "Kasir Bantar Gebang 1", "varianceReason": null}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"source": "pos.close_shift", "closedAt": "2026-07-23T00:08:36.148Z"}	2026-07-23 00:08:36.148+00
5b1c7246-1a5c-4c2f-b153-94b4a4f61193	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	register.update	register	066908eb-8d08-4676-a136-197b9af1a7fc	{"code": "POS-02", "name": "POS Sales", "isActive": true, "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "isHardwareHub": false}	{"code": "POS-02", "name": "POS Sales", "isActive": true, "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "isHardwareHub": false, "replacedHardwareHub": null}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-23 00:08:57.094158+00
a3416f31-86c9-424b-beb9-84cab30358bc	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	shift.close	shift	a0af43ba-c501-4f7b-987b-f71ca958c5cb	{"status": "open", "expectedCash": "500000"}	{"status": "closed", "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "actualCash": "500000", "outletCode": "TOKO-BG", "outletName": "Bantar Gebang", "registerId": "066908eb-8d08-4676-a136-197b9af1a7fc", "cashSummary": {"cashIn": 0, "cashOut": 0, "cashSales": 0, "cashRefunds": 0, "expectedCash": 500000, "movementCount": 1, "openingBalance": 500000, "closingAdjustments": 0}, "openingCash": "500000", "cashVariance": "0", "expectedCash": "500000", "registerCode": "POS-02", "registerName": "POS Sales", "varianceReason": null}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"source": "admin.shift_dashboard", "closedAt": "2026-07-23T00:09:26.500Z"}	2026-07-23 00:09:26.5+00
7bebfa6e-c536-4026-93b8-0e944acbc785	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	register.update	register	066908eb-8d08-4676-a136-197b9af1a7fc	{"code": "POS-02", "name": "POS Sales", "isActive": true, "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "isHardwareHub": false}	{"code": "POS-02", "name": "POS Sales", "isActive": false, "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "isHardwareHub": false, "replacedHardwareHub": null}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{}	2026-07-23 00:09:38.858288+00
daaebeab-693c-4cef-aba6-a274b4d85e4d	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	auth.login	user	840c182b-642d-438d-b6ee-24f1e56833a3	\N	{"method": "password"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{}	2026-07-23 07:33:20.996255+00
ea29ae5a-0eaf-4f98-8af3-a888a13491d8	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	shift.open	shift	58c24186-e578-4f6b-91d4-5ebbc3bf0b64	\N	{"note": "Hanita: Shift pagi bantar gebang", "shiftId": "58c24186-e578-4f6b-91d4-5ebbc3bf0b64", "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "outletCode": "TOKO-BG", "registerId": "36961177-52d1-45e7-ba0c-d1bf785ce2da", "openingCash": "65000", "registerCode": "POS-BG1", "registerName": "Kasir Bantar Gebang 1"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"source": "pos.open_shift"}	2026-07-23 07:46:22.725157+00
3cb88ecf-c874-4b17-98de-5dc6dfb656d3	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	sale.completed	sale	baf96a0f-bf66-4fb2-8381-02a0b3e6f33d	\N	{"saleId": "baf96a0f-bf66-4fb2-8381-02a0b3e6f33d", "shiftId": "58c24186-e578-4f6b-91d4-5ebbc3bf0b64", "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "payments": [{"amount": "2062500", "method": "cash", "provider": null, "reference": null, "changeAmount": 0}, {"amount": "1600000", "method": "cash", "provider": null, "reference": null, "changeAmount": 0}], "cashierId": "840c182b-642d-438d-b6ee-24f1e56833a3", "itemCount": 1, "customerId": "da5c8f1c-9d23-4085-ad57-f2d1cbed9fec", "outletCode": "TOKO-BG", "registerId": "36961177-52d1-45e7-ba0c-d1bf785ce2da", "totalAmount": "2062500", "customerCode": "CUST-20260723-04F7E805", "customerName": "Siti Aminah", "registerCode": "POS-BG1", "invoiceNumber": "AJ-TOKO-BG-20260723-3219EA91", "discountAmount": "0", "discountReason": null, "subtotalAmount": "2062500", "discountApprovalId": null, "customerDepositInAmount": "1600000", "externalPaymentDueAmount": "3662500", "customerDepositUsedAmount": "0"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"source": "pos.checkout", "customerId": "da5c8f1c-9d23-4085-ad57-f2d1cbed9fec", "idempotencyKey": "pos_dfafc2ba-2314-4ae3-8ede-daa9548995ba", "discountApprovalId": null, "customerDepositInAmount": "1600000", "customerDepositUsedAmount": "0"}	2026-07-23 08:11:56.008+00
95f0043c-f72c-4eac-ad2c-4b1221cd6731	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	hardware.job_created	hardware_job	a0e5b01d-b045-4840-903b-29e552610b60	\N	{"status": "pending", "jobType": "print_receipt_certificate", "sourceId": "baf96a0f-bf66-4fb2-8381-02a0b3e6f33d", "expiresAt": "2026-07-23T12:11:56.008Z", "sourceType": "sale", "targetAgentId": null, "protocolVersion": 2, "requiredCapability": "print_document_pdf"}	\N	pos_dfafc2ba-2314-4ae3-8ede-daa9548995ba	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"source": "pos.checkout", "payloadHash": "08c1d68e9735317950669a08809529a02baef9b3951a3b3b9721b62a775e3ad9", "creationMode": "automatic", "idempotencyKey": "receipt:baf96a0f-bf66-4fb2-8381-02a0b3e6f33d:initial"}	2026-07-23 08:11:56.008+00
2274c0e6-d249-4354-b886-6ac40dd30e91	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	sale.completed	sale	902fd7b7-e2c9-4acb-8b4b-caa515a84592	\N	{"saleId": "902fd7b7-e2c9-4acb-8b4b-caa515a84592", "shiftId": "58c24186-e578-4f6b-91d4-5ebbc3bf0b64", "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "payments": [], "cashierId": "840c182b-642d-438d-b6ee-24f1e56833a3", "itemCount": 1, "customerId": "da5c8f1c-9d23-4085-ad57-f2d1cbed9fec", "outletCode": "TOKO-BG", "registerId": "36961177-52d1-45e7-ba0c-d1bf785ce2da", "totalAmount": "1450000", "customerCode": "CUST-20260723-04F7E805", "customerName": "Siti Aminah", "registerCode": "POS-BG1", "invoiceNumber": "AJ-TOKO-BG-20260723-D2B23D66", "discountAmount": "0", "discountReason": null, "subtotalAmount": "1450000", "discountApprovalId": null, "customerDepositInAmount": "0", "externalPaymentDueAmount": "0", "customerDepositUsedAmount": "1450000"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"source": "pos.checkout", "customerId": "da5c8f1c-9d23-4085-ad57-f2d1cbed9fec", "idempotencyKey": "pos_db56dd2d-0d35-418f-8b5d-1be726a66a4d", "discountApprovalId": null, "customerDepositInAmount": "0", "customerDepositUsedAmount": "1450000"}	2026-07-23 08:13:19.384+00
a8db6876-32cd-431e-8c36-3bae382629ea	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	hardware.job_created	hardware_job	2156f63c-0e7d-4131-b8d2-89b55ca8c8a7	\N	{"status": "pending", "jobType": "print_receipt_certificate", "sourceId": "902fd7b7-e2c9-4acb-8b4b-caa515a84592", "expiresAt": "2026-07-23T12:13:19.384Z", "sourceType": "sale", "targetAgentId": null, "protocolVersion": 2, "requiredCapability": "print_document_pdf"}	\N	pos_db56dd2d-0d35-418f-8b5d-1be726a66a4d	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"source": "pos.checkout", "payloadHash": "237031bb94eed9274ed25261ecdd94f70718aa95d684145c001ecfe6365dd5dd", "creationMode": "automatic", "idempotencyKey": "receipt:902fd7b7-e2c9-4acb-8b4b-caa515a84592:initial"}	2026-07-23 08:13:19.384+00
4f9a0fe4-baaf-4a74-970b-a94581bbd545	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	product_item.create	product_item	8f21c222-d2fa-4fb8-ad5b-a5467269af00	\N	{"sku": "AJ-ITEM-00000005", "size": "8", "color": "Rose Gold", "barcode": "AJ00000005", "qrValue": "AJ00000005", "gemstone": "Zircon", "imageKey": "organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/items/8f21c222-d2fa-4fb8-ad5b-a5467269af00/8850bdae-6508-403e-ad3d-e04f5994b183.webp", "condition": "good", "costAmount": "700000", "outletCode": "TOKO-BG", "outletName": "Bantar Gebang", "weightGram": "1.250", "displayName": "Isodora Gold Ring", "productCode": "WEDDING-BRACELET", "productName": "Gelang Solitaire Aurelia", "availability": "available", "locationCode": "ETALASE-B-01", "pricePerGram": "650000", "purityPercent": "35.2", "sellingAmount": "1250000", "currentOutletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "productMasterId": "0bdd002c-78a4-41fe-944c-97fe439a7fa6", "deductionPerGram": "350000", "exchangePurityPercent": "48", "pricingManagedByActor": true}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{}	2026-07-23 08:19:15.561021+00
f281ccb2-1db9-4ccd-aac1-9d357d0f7f0c	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_dispatch_started	hardware_job	a0e5b01d-b045-4840-903b-29e552610b60	{"jobStatus": "processing", "attemptStatus": "processing", "eventSequence": 1}	{"jobStatus": "processing", "disposition": "updated", "attemptStatus": "dispatching", "eventSequence": 2}	\N	be6437c8-0cce-4a8d-ac33-096ff3429e97:dispatching:2	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "be6437c8-0cce-4a8d-ac33-096ff3429e97", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-23T08:51:31.870Z", "protocolVersion": 2}	2026-07-23 08:51:33.248147+00
1a348f7e-0d7f-43c3-9af1-273c805bfc31	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_submitted	hardware_job	a0e5b01d-b045-4840-903b-29e552610b60	{"jobStatus": "processing", "attemptStatus": "dispatching", "eventSequence": 2}	{"jobStatus": "submitted", "disposition": "updated", "attemptStatus": "submitted", "eventSequence": 3}	\N	be6437c8-0cce-4a8d-ac33-096ff3429e97:submitted:3	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "be6437c8-0cce-4a8d-ac33-096ff3429e97", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-23T08:51:33.272Z", "protocolVersion": 2}	2026-07-23 08:51:34.657123+00
9635318e-8e47-47f7-a3b8-c47ce675116c	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_completed	hardware_job	a0e5b01d-b045-4840-903b-29e552610b60	{"jobStatus": "submitted", "attemptStatus": "submitted", "eventSequence": 3}	{"jobStatus": "completed", "disposition": "updated", "attemptStatus": "acknowledged", "eventSequence": 4}	\N	be6437c8-0cce-4a8d-ac33-096ff3429e97:acknowledged:4	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "be6437c8-0cce-4a8d-ac33-096ff3429e97", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-23T08:51:34.674Z", "protocolVersion": 2}	2026-07-23 08:51:36.126355+00
178108cd-9fea-406f-9c00-cc93e98d7b1c	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_dispatch_started	hardware_job	2156f63c-0e7d-4131-b8d2-89b55ca8c8a7	{"jobStatus": "processing", "attemptStatus": "processing", "eventSequence": 1}	{"jobStatus": "processing", "disposition": "updated", "attemptStatus": "dispatching", "eventSequence": 2}	\N	6d1d8c96-4551-4679-a3b1-a20b364089ce:dispatching:2	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "6d1d8c96-4551-4679-a3b1-a20b364089ce", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-23T08:51:43.062Z", "protocolVersion": 2}	2026-07-23 08:51:44.416631+00
602328f6-fe8d-4716-bd74-9fad65120abc	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_submitted	hardware_job	2156f63c-0e7d-4131-b8d2-89b55ca8c8a7	{"jobStatus": "processing", "attemptStatus": "dispatching", "eventSequence": 2}	{"jobStatus": "submitted", "disposition": "updated", "attemptStatus": "submitted", "eventSequence": 3}	\N	6d1d8c96-4551-4679-a3b1-a20b364089ce:submitted:3	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "6d1d8c96-4551-4679-a3b1-a20b364089ce", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-23T08:51:44.429Z", "protocolVersion": 2}	2026-07-23 08:51:45.810525+00
ef6e22bf-f5d2-4d7d-bc7b-1191c849f599	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_completed	hardware_job	2156f63c-0e7d-4131-b8d2-89b55ca8c8a7	{"jobStatus": "submitted", "attemptStatus": "submitted", "eventSequence": 3}	{"jobStatus": "completed", "disposition": "updated", "attemptStatus": "acknowledged", "eventSequence": 4}	\N	6d1d8c96-4551-4679-a3b1-a20b364089ce:acknowledged:4	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "6d1d8c96-4551-4679-a3b1-a20b364089ce", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-23T08:51:45.821Z", "protocolVersion": 2}	2026-07-23 08:51:47.210609+00
77e7b38e-ed0c-43cf-8a17-b6ddb50222d0	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	hardware.job_created	hardware_job	b6104d08-604b-4612-a2f0-d60228c27da3	\N	{"status": "pending", "jobType": "print_receipt_certificate", "sourceId": "baf96a0f-bf66-4fb2-8381-02a0b3e6f33d", "expiresAt": "2026-07-23T16:53:03.193Z", "sourceType": "sale", "targetAgentId": null, "protocolVersion": 2, "requiredCapability": "print_document_pdf"}	Cetak ulang nota AJ-TOKO-BG-20260723-3219EA91.	76b884f3-c310-4e75-a021-a777341cd1c3	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"source": "admin.sales.detail", "payloadHash": "e8dfc3bdd0683f9274f04ee6c8c32f37a8fd8ade97d98fba14ca57869bb71e14", "creationMode": "manual", "idempotencyKey": "receipt:baf96a0f-bf66-4fb2-8381-02a0b3e6f33d:reprint:76b884f3-c310-4e75-a021-a777341cd1c3"}	2026-07-23 08:53:03.193+00
5769d812-65a6-4463-9dd5-d1e245f3e0a2	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	sale.receipt_reprint_requested	sale	baf96a0f-bf66-4fb2-8381-02a0b3e6f33d	\N	{"saleId": "baf96a0f-bf66-4fb2-8381-02a0b3e6f33d", "duplicate": false, "queueState": "online", "hardwareJobId": "b6104d08-604b-4612-a2f0-d60228c27da3", "invoiceNumber": "AJ-TOKO-BG-20260723-3219EA91"}	\N	\N	\N	\N	{"source": "admin.sales.detail", "jobType": "print_receipt_certificate", "documentMode": "one_page_per_item"}	2026-07-23 08:53:03.193+00
cd074252-477c-4d74-906d-ae6ee71bc1e5	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_dispatch_started	hardware_job	b6104d08-604b-4612-a2f0-d60228c27da3	{"jobStatus": "processing", "attemptStatus": "processing", "eventSequence": 1}	{"jobStatus": "processing", "disposition": "updated", "attemptStatus": "dispatching", "eventSequence": 2}	\N	897c09af-d857-4ff8-8e15-a912fc95d228:dispatching:2	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "897c09af-d857-4ff8-8e15-a912fc95d228", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-23T08:53:08.608Z", "protocolVersion": 2}	2026-07-23 08:53:09.899699+00
c774aef4-0dad-4478-a81e-d91274f6e3dc	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_submitted	hardware_job	b6104d08-604b-4612-a2f0-d60228c27da3	{"jobStatus": "processing", "attemptStatus": "dispatching", "eventSequence": 2}	{"jobStatus": "submitted", "disposition": "updated", "attemptStatus": "submitted", "eventSequence": 3}	\N	897c09af-d857-4ff8-8e15-a912fc95d228:submitted:3	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "897c09af-d857-4ff8-8e15-a912fc95d228", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-23T08:53:09.926Z", "protocolVersion": 2}	2026-07-23 08:53:11.411699+00
48609827-857e-4fb4-984e-d97f1ece4fe2	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_completed	hardware_job	b6104d08-604b-4612-a2f0-d60228c27da3	{"jobStatus": "submitted", "attemptStatus": "submitted", "eventSequence": 3}	{"jobStatus": "completed", "disposition": "updated", "attemptStatus": "acknowledged", "eventSequence": 4}	\N	897c09af-d857-4ff8-8e15-a912fc95d228:acknowledged:4	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "897c09af-d857-4ff8-8e15-a912fc95d228", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-23T08:53:11.427Z", "protocolVersion": 2}	2026-07-23 08:53:12.852628+00
11cd99cc-63d8-4f4d-880e-758afdbe9fb5	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	hardware.job_created	hardware_job	09355cc5-f38b-4d47-ba1e-178e4d336c87	\N	{"status": "pending", "jobType": "print_receipt_certificate", "sourceId": "a05177cf-aa7d-4258-8526-fb36c838dc50", "expiresAt": "2026-07-23T16:55:08.114Z", "sourceType": "sale", "targetAgentId": null, "protocolVersion": 2, "requiredCapability": "print_document_pdf"}	Cetak ulang invoice AJ-TOKO-BG-20260723-755DB604.	da839ad3-79f0-4ec6-a77c-ec18e14a9504	\N	\N	{"source": "pos.transaction_detail", "payloadHash": "fbf5efe046f9c5f2cd5f8928408de01edc180b3d51adc36704d8aa74b243c0d0", "creationMode": "manual", "idempotencyKey": "receipt:a05177cf-aa7d-4258-8526-fb36c838dc50:reprint:da839ad3-79f0-4ec6-a77c-ec18e14a9504"}	2026-07-23 08:55:08.114+00
1f6bba53-7df7-42d1-9604-4103863256f0	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	customer_deposit.withdrawal_approval_requested	customer	da5c8f1c-9d23-4085-ad57-f2d1cbed9fec	{"balance": 150000}	{"status": "pending", "approvalId": "95f9bede-076c-4e2e-99a3-0c64af51849a", "approvalType": "customer_deposit_withdrawal", "withdrawalAmount": 50000, "balanceAfterIfApproved": 100000}	Customer meminta dana titip 50ribu	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"source": "admin.customer.detail", "approvalId": "95f9bede-076c-4e2e-99a3-0c64af51849a", "outletCode": "TOKO-BG", "outletName": "Bantar Gebang", "customerCode": "CUST-20260723-04F7E805", "customerName": "Siti Aminah"}	2026-07-23 18:31:24.93+00
2b155242-767a-4c53-9f45-62e26904ba6c	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	09bf466f-0533-402a-8175-f12c05fbe101	auth.login	user	09bf466f-0533-402a-8175-f12c05fbe101	\N	{"method": "password"}	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0	{}	2026-07-23 18:37:18.003229+00
88c451f5-d248-4b2d-8930-654cc501ec85	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	staff.create	user	09bf466f-0533-402a-8175-f12c05fbe101	\N	{"email": "eramistik@asihjaya.local", "phone": "081234567891", "status": "active", "roleIds": ["acfcbb18-c1c1-4540-bb72-ffdcdf88f757"], "fullName": "Era Mistik", "username": "eramistik", "outletIds": ["6eabe9d2-5b95-46c6-802b-f229e895bc9a"], "primaryOutletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{}	2026-07-23 18:36:41.208038+00
00a17c18-7fe4-408d-a0b5-7b99b91eef06	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	09bf466f-0533-402a-8175-f12c05fbe101	approval.reject	approval	95f9bede-076c-4e2e-99a3-0c64af51849a	{"status": "pending", "approvedBy": null, "resolvedAt": null, "responseNotes": null}	{"type": "customer_deposit_withdrawal", "status": "rejected", "approvedBy": "09bf466f-0533-402a-8175-f12c05fbe101", "resolvedAt": "2026-07-23T18:37:42.226Z", "referenceId": "da5c8f1c-9d23-4085-ad57-f2d1cbed9fec", "referenceType": "customer", "responseNotes": "Maaf tidak bisa tarik dana titipan untuk saat ini", "executionStage": null}	Maaf tidak bisa tarik dana titipan untuk saat ini	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0	{"requestData": {"reason": "Customer meminta dana titip 50ribu", "source": "admin.customer.detail", "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "customerId": "da5c8f1c-9d23-4085-ad57-f2d1cbed9fec", "outletCode": "TOKO-BG", "outletName": "Bantar Gebang", "flowVersion": "p4.5-a", "requestedAt": "2026-07-23T18:31:24.930Z", "requesterId": "840c182b-642d-438d-b6ee-24f1e56833a3", "customerCode": "CUST-20260723-04F7E805", "customerName": "Siti Aminah", "balanceBefore": 150000, "customerPhone": "081234567868", "depositAmount": 50000, "requesterName": "System Administrator", "executionStage": "awaiting_approval", "withdrawalAmount": 50000, "executionRequired": true, "balanceAfterIfApproved": 100000}, "requestedBy": "840c182b-642d-438d-b6ee-24f1e56833a3", "approvalType": "customer_deposit_withdrawal", "makerCheckerEnforced": true}	2026-07-23 18:37:42.230738+00
d5dc185b-1092-4ae5-8670-c12e3d664e0f	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	09bf466f-0533-402a-8175-f12c05fbe101	auth.logout	user_session	a540cb5c-1aa7-4f64-b150-99d3380af372	\N	\N	\N	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0	{}	2026-07-23 18:45:20.797949+00
b47b2a46-0cda-41fa-b4ab-b9695dadc987	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	auth.login	user	840c182b-642d-438d-b6ee-24f1e56833a3	\N	{"method": "password"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{}	2026-07-23 23:26:08.176041+00
78954672-e09d-4181-b66a-f2554c161185	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	auth.login	user	840c182b-642d-438d-b6ee-24f1e56833a3	\N	{"method": "password"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{}	2026-07-25 07:03:05.652686+00
eaba0a23-5127-4a26-bcec-1c58147a35bd	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	auth.login	user	840c182b-642d-438d-b6ee-24f1e56833a3	\N	{"method": "password"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{}	2026-07-25 19:06:50.973732+00
647e8595-5bed-4efd-b1a6-44e39d37fb58	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	auth.login	user	840c182b-642d-438d-b6ee-24f1e56833a3	\N	{"method": "password"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{}	2026-07-26 08:28:12.330759+00
359fb334-a17e-4a6b-bde8-0906e69124f8	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	hardware.job_created	hardware_job	c2a143b9-9bf8-4645-97a4-0735f3266300	\N	{"status": "pending", "jobType": "print_receipt_certificate", "sourceId": "902fd7b7-e2c9-4acb-8b4b-caa515a84592", "expiresAt": "2026-07-26T17:54:09.563Z", "sourceType": "sale", "targetAgentId": null, "protocolVersion": 2, "requiredCapability": "print_document_pdf"}	Cetak ulang nota AJ-TOKO-BG-20260723-D2B23D66 memakai overlay kertas custom.	3b2f5a40-18d6-4491-89e5-b31be351a656	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"source": "admin.sales.detail", "payloadHash": "7b80a5eaec53c02a7bb397256cb73f06cc108ec8c42709eb0f076eee63f14934", "creationMode": "manual", "idempotencyKey": "receipt:902fd7b7-e2c9-4acb-8b4b-caa515a84592:reprint:3b2f5a40-18d6-4491-89e5-b31be351a656"}	2026-07-26 09:54:09.563+00
22f83631-cf1c-4e03-8d80-e40b5f8760db	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	sale.receipt_reprint_requested	sale	902fd7b7-e2c9-4acb-8b4b-caa515a84592	\N	{"saleId": "902fd7b7-e2c9-4acb-8b4b-caa515a84592", "duplicate": false, "queueState": "online", "renderMode": "preprinted_overlay", "hardwareJobId": "c2a143b9-9bf8-4645-97a4-0735f3266300", "invoiceNumber": "AJ-TOKO-BG-20260723-D2B23D66"}	\N	\N	\N	\N	{"source": "admin.sales.detail", "jobType": "print_receipt_certificate", "renderMode": "preprinted_overlay", "documentMode": "one_page_per_item"}	2026-07-26 09:54:09.563+00
2b4a9c1f-e5d5-4a65-9bd0-aff7b4e102d8	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	hardware.job_created	hardware_job	1d6b2f65-f8aa-4c5e-961a-d97bdaa1052c	\N	{"status": "pending", "jobType": "print_receipt_certificate", "sourceId": "902fd7b7-e2c9-4acb-8b4b-caa515a84592", "expiresAt": "2026-07-26T17:54:32.976Z", "sourceType": "sale", "targetAgentId": null, "protocolVersion": 2, "requiredCapability": "print_document_pdf"}	Cetak ulang nota AJ-TOKO-BG-20260723-D2B23D66 memakai overlay kertas custom.	e553ef92-d692-4fe3-a716-09f6da2cd35d	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"source": "admin.sales.detail", "payloadHash": "00762507d4aa4edd7f309b7262a88aa4111f452a0f6d6fc26b3d13dfb44a2b40", "creationMode": "manual", "idempotencyKey": "receipt:902fd7b7-e2c9-4acb-8b4b-caa515a84592:reprint:e553ef92-d692-4fe3-a716-09f6da2cd35d"}	2026-07-26 09:54:32.976+00
1c569932-7be6-4852-8cef-397964a2b6b3	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	sale.receipt_reprint_requested	sale	902fd7b7-e2c9-4acb-8b4b-caa515a84592	\N	{"saleId": "902fd7b7-e2c9-4acb-8b4b-caa515a84592", "duplicate": false, "queueState": "online", "renderMode": "preprinted_overlay", "hardwareJobId": "1d6b2f65-f8aa-4c5e-961a-d97bdaa1052c", "invoiceNumber": "AJ-TOKO-BG-20260723-D2B23D66"}	\N	\N	\N	\N	{"source": "admin.sales.detail", "jobType": "print_receipt_certificate", "renderMode": "preprinted_overlay", "documentMode": "one_page_per_item"}	2026-07-26 09:54:32.976+00
6813ba05-0503-463f-a9f7-963e4ae65f4f	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_dispatch_started	hardware_job	1d6b2f65-f8aa-4c5e-961a-d97bdaa1052c	{"jobStatus": "processing", "attemptStatus": "processing", "eventSequence": 1}	{"jobStatus": "processing", "disposition": "updated", "attemptStatus": "dispatching", "eventSequence": 2}	\N	3823bcc8-b7fa-4c8f-bfa3-8a0b0b8c67d9:dispatching:2	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "3823bcc8-b7fa-4c8f-bfa3-8a0b0b8c67d9", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-26T09:54:39.159Z", "protocolVersion": 2}	2026-07-26 09:54:40.498872+00
94e0bb45-354a-4311-b0fd-fee1366ce03c	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	sale.receipt_reprint_requested	sale	baf96a0f-bf66-4fb2-8381-02a0b3e6f33d	\N	{"saleId": "baf96a0f-bf66-4fb2-8381-02a0b3e6f33d", "duplicate": false, "queueState": "online", "renderMode": "preprinted_overlay", "hardwareJobId": "5ac1e68a-d200-40e9-94d1-ee09fd2324fb", "invoiceNumber": "AJ-TOKO-BG-20260723-3219EA91"}	\N	\N	\N	\N	{"source": "admin.sales.detail", "jobType": "print_receipt_certificate", "renderMode": "preprinted_overlay", "documentMode": "one_page_per_item"}	2026-07-27 08:43:05.882+00
1087f9c4-4173-4418-94b1-57d508c3faac	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_submitted	hardware_job	1d6b2f65-f8aa-4c5e-961a-d97bdaa1052c	{"jobStatus": "processing", "attemptStatus": "dispatching", "eventSequence": 2}	{"jobStatus": "submitted", "disposition": "updated", "attemptStatus": "submitted", "eventSequence": 3}	\N	3823bcc8-b7fa-4c8f-bfa3-8a0b0b8c67d9:submitted:3	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "3823bcc8-b7fa-4c8f-bfa3-8a0b0b8c67d9", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-26T09:54:40.513Z", "protocolVersion": 2}	2026-07-26 09:54:41.806434+00
cd3f32a5-c559-4ace-98f0-9588fd348bb2	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_completed	hardware_job	1d6b2f65-f8aa-4c5e-961a-d97bdaa1052c	{"jobStatus": "submitted", "attemptStatus": "submitted", "eventSequence": 3}	{"jobStatus": "completed", "disposition": "updated", "attemptStatus": "acknowledged", "eventSequence": 4}	\N	3823bcc8-b7fa-4c8f-bfa3-8a0b0b8c67d9:acknowledged:4	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "3823bcc8-b7fa-4c8f-bfa3-8a0b0b8c67d9", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-26T09:54:41.821Z", "protocolVersion": 2}	2026-07-26 09:54:43.119328+00
64413508-9f5f-4e3a-8681-14272306ed31	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	auth.login	user	840c182b-642d-438d-b6ee-24f1e56833a3	\N	{"method": "password"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{}	2026-07-27 06:17:24.089576+00
df8b2ee2-4e6e-4e9f-9861-0e24f10c0c51	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	customer.history_pin.create	customer	da5c8f1c-9d23-4085-ad57-f2d1cbed9fec	\N	{"mustChangePin": true, "sessionsRevoked": true, "credentialVersion": 1}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"source": "admin.customer-detail", "temporaryPinDisplayedOnce": true}	2026-07-27 06:17:55.188296+00
9c3b3721-ab3f-418e-8aa3-9434ae4dcc21	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	customer.history_pin.verify_success	customer	da5c8f1c-9d23-4085-ad57-f2d1cbed9fec	\N	\N	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"source": "public.customer-history", "requiresPinChange": true, "receiptTokenVersion": "v2"}	2026-07-27 06:18:39.567119+00
2aa4aaf5-3da4-4885-9898-fc7895c4ae2c	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	customer.history_pin.change_initial	customer	da5c8f1c-9d23-4085-ad57-f2d1cbed9fec	{"mustChangePin": true, "credentialVersion": 1}	{"mustChangePin": false, "credentialVersion": 2}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"source": "public.customer-history"}	2026-07-27 06:19:01.527675+00
dea74aab-d7c6-4772-b3f1-2893fd2f8c9a	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	hardware.job_created	hardware_job	fb90cb13-6752-40c1-b9b9-f6e7e54e7cf4	\N	{"status": "pending", "jobType": "print_receipt_certificate", "sourceId": "902fd7b7-e2c9-4acb-8b4b-caa515a84592", "expiresAt": "2026-07-27T15:08:01.316Z", "sourceType": "sale", "targetAgentId": null, "protocolVersion": 2, "requiredCapability": "print_document_pdf"}	Cetak ulang nota AJ-TOKO-BG-20260723-D2B23D66 memakai overlay kertas custom.	ecc21216-6af8-422f-89f7-541ddae7e071	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"source": "admin.sales.detail", "payloadHash": "22da68121a22e05c8dd8473593413beacdd365294d7032f56d6d87bf484ffb2c", "creationMode": "manual", "idempotencyKey": "receipt:902fd7b7-e2c9-4acb-8b4b-caa515a84592:reprint:ecc21216-6af8-422f-89f7-541ddae7e071"}	2026-07-27 07:08:01.316+00
47b2bd29-902e-420d-9bc8-b17be0e2eb2c	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	sale.receipt_reprint_requested	sale	902fd7b7-e2c9-4acb-8b4b-caa515a84592	\N	{"saleId": "902fd7b7-e2c9-4acb-8b4b-caa515a84592", "duplicate": false, "queueState": "online", "renderMode": "preprinted_overlay", "hardwareJobId": "fb90cb13-6752-40c1-b9b9-f6e7e54e7cf4", "invoiceNumber": "AJ-TOKO-BG-20260723-D2B23D66"}	\N	\N	\N	\N	{"source": "admin.sales.detail", "jobType": "print_receipt_certificate", "renderMode": "preprinted_overlay", "documentMode": "one_page_per_item"}	2026-07-27 07:08:01.316+00
8fad2e47-8bb0-4935-b1e8-c4138e8c02d4	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_dispatch_started	hardware_job	fb90cb13-6752-40c1-b9b9-f6e7e54e7cf4	{"jobStatus": "processing", "attemptStatus": "processing", "eventSequence": 1}	{"jobStatus": "processing", "disposition": "updated", "attemptStatus": "dispatching", "eventSequence": 2}	\N	7939ace8-097f-417c-a766-acba6d129689:dispatching:2	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "7939ace8-097f-417c-a766-acba6d129689", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-27T07:08:06.637Z", "protocolVersion": 2}	2026-07-27 07:08:07.928992+00
1a5849b7-8220-4f67-8a5f-1573cdd10b25	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_submitted	hardware_job	fb90cb13-6752-40c1-b9b9-f6e7e54e7cf4	{"jobStatus": "processing", "attemptStatus": "dispatching", "eventSequence": 2}	{"jobStatus": "submitted", "disposition": "updated", "attemptStatus": "submitted", "eventSequence": 3}	\N	7939ace8-097f-417c-a766-acba6d129689:submitted:3	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "7939ace8-097f-417c-a766-acba6d129689", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-27T07:08:07.951Z", "protocolVersion": 2}	2026-07-27 07:08:09.287268+00
c7292c02-1cad-4e41-a0c3-5c8a95d2d69d	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_completed	hardware_job	fb90cb13-6752-40c1-b9b9-f6e7e54e7cf4	{"jobStatus": "submitted", "attemptStatus": "submitted", "eventSequence": 3}	{"jobStatus": "completed", "disposition": "updated", "attemptStatus": "acknowledged", "eventSequence": 4}	\N	7939ace8-097f-417c-a766-acba6d129689:acknowledged:4	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "7939ace8-097f-417c-a766-acba6d129689", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-27T07:08:09.307Z", "protocolVersion": 2}	2026-07-27 07:08:10.647738+00
4595cbd3-766f-439e-8afb-a13181afe875	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	hardware.job_created	hardware_job	5ac1e68a-d200-40e9-94d1-ee09fd2324fb	\N	{"status": "pending", "jobType": "print_receipt_certificate", "sourceId": "baf96a0f-bf66-4fb2-8381-02a0b3e6f33d", "expiresAt": "2026-07-27T16:43:05.882Z", "sourceType": "sale", "targetAgentId": null, "protocolVersion": 2, "requiredCapability": "print_document_pdf"}	Cetak ulang nota AJ-TOKO-BG-20260723-3219EA91 memakai overlay kertas custom.	a38439ee-b21f-496e-ae62-80ab7a8428c9	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"source": "admin.sales.detail", "payloadHash": "360de122226a2ff783861464469739a320fc969342768075a155d8638e41606d", "creationMode": "manual", "idempotencyKey": "receipt:baf96a0f-bf66-4fb2-8381-02a0b3e6f33d:reprint:a38439ee-b21f-496e-ae62-80ab7a8428c9"}	2026-07-27 08:43:05.882+00
a0b3e7d9-7fe8-4ad0-b3f1-d267c84e3c17	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_dispatch_started	hardware_job	5ac1e68a-d200-40e9-94d1-ee09fd2324fb	{"jobStatus": "processing", "attemptStatus": "processing", "eventSequence": 1}	{"jobStatus": "processing", "disposition": "updated", "attemptStatus": "dispatching", "eventSequence": 2}	\N	cf7eac61-cb18-4756-b133-2a5c60e4c56d:dispatching:2	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "cf7eac61-cb18-4756-b133-2a5c60e4c56d", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-27T08:43:11.925Z", "protocolVersion": 2}	2026-07-27 08:43:12.998309+00
28f7e875-e8c0-44d0-8b28-e4cb863d102f	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_submitted	hardware_job	5ac1e68a-d200-40e9-94d1-ee09fd2324fb	{"jobStatus": "processing", "attemptStatus": "dispatching", "eventSequence": 2}	{"jobStatus": "submitted", "disposition": "updated", "attemptStatus": "submitted", "eventSequence": 3}	\N	cf7eac61-cb18-4756-b133-2a5c60e4c56d:submitted:3	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "cf7eac61-cb18-4756-b133-2a5c60e4c56d", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-27T08:43:13.014Z", "protocolVersion": 2}	2026-07-27 08:43:14.347696+00
398e5fe5-685d-4968-9b03-d1a90b944060	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_completed	hardware_job	5ac1e68a-d200-40e9-94d1-ee09fd2324fb	{"jobStatus": "submitted", "attemptStatus": "submitted", "eventSequence": 3}	{"jobStatus": "completed", "disposition": "updated", "attemptStatus": "acknowledged", "eventSequence": 4}	\N	cf7eac61-cb18-4756-b133-2a5c60e4c56d:acknowledged:4	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "print_receipt_certificate", "attemptId": "cf7eac61-cb18-4756-b133-2a5c60e4c56d", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-27T08:43:14.359Z", "protocolVersion": 2}	2026-07-27 08:43:15.480289+00
4ba103e7-21e5-4224-9e49-30e4e69f7090	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	hardware.job_created	hardware_job	aaf1e683-1141-447f-9b2b-c1ecdfd529e2	\N	{"status": "pending", "jobType": "test_label_printer", "sourceId": "c6799b50-7084-4d01-8847-537477fb9fff", "expiresAt": "2026-07-27T08:48:42.346Z", "sourceType": "hardware_test", "targetAgentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "protocolVersion": 2, "requiredCapability": "print_label_sato"}	Menjalankan test label printer untuk agent TOKO-BG1.	c6799b50-7084-4d01-8847-537477fb9fff	\N	\N	{"source": "admin.hardware_dashboard", "payloadHash": "eded3ede48625ae189d217979121d1bd6407dcbe428839698a12f74629b9186d", "creationMode": "test", "idempotencyKey": "hardware-test:c6799b50-7084-4d01-8847-537477fb9fff"}	2026-07-27 08:46:42.346+00
34553d3c-4b59-49b5-8a0c-54d511851bf5	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	hardware.job_created	hardware_job	2026074a-7218-4b58-88e1-a812455e58d8	\N	{"status": "pending", "jobType": "test_label_printer", "sourceId": "78d974cc-3152-48a9-8442-933acb7e0305", "expiresAt": "2026-07-27T08:49:08.272Z", "sourceType": "hardware_test", "targetAgentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "protocolVersion": 2, "requiredCapability": "print_label_sato"}	Menjalankan test label printer untuk agent TOKO-BG1.	78d974cc-3152-48a9-8442-933acb7e0305	\N	\N	{"source": "admin.hardware_dashboard", "payloadHash": "eded3ede48625ae189d217979121d1bd6407dcbe428839698a12f74629b9186d", "creationMode": "test", "idempotencyKey": "hardware-test:78d974cc-3152-48a9-8442-933acb7e0305"}	2026-07-27 08:47:08.272+00
bcdecbbb-dcfb-46f5-8e84-d12a05ba2d41	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_dispatch_started	hardware_job	2026074a-7218-4b58-88e1-a812455e58d8	{"jobStatus": "processing", "attemptStatus": "processing", "eventSequence": 1}	{"jobStatus": "processing", "disposition": "updated", "attemptStatus": "dispatching", "eventSequence": 2}	\N	85bbf9bc-b3d5-4c4d-8fc6-24d14ec450c9:dispatching:2	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "test_label_printer", "attemptId": "85bbf9bc-b3d5-4c4d-8fc6-24d14ec450c9", "errorCode": null, "retrySafe": null, "deviceType": "label_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-27T08:47:11.504Z", "protocolVersion": 2}	2026-07-27 08:47:12.645295+00
b1c2d94a-38e7-45d1-8e18-a86430fae94b	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_submitted	hardware_job	2026074a-7218-4b58-88e1-a812455e58d8	{"jobStatus": "processing", "attemptStatus": "dispatching", "eventSequence": 2}	{"jobStatus": "submitted", "disposition": "updated", "attemptStatus": "submitted", "eventSequence": 3}	\N	85bbf9bc-b3d5-4c4d-8fc6-24d14ec450c9:submitted:3	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "test_label_printer", "attemptId": "85bbf9bc-b3d5-4c4d-8fc6-24d14ec450c9", "errorCode": null, "retrySafe": null, "deviceType": "label_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-27T08:47:12.658Z", "protocolVersion": 2}	2026-07-27 08:47:13.811014+00
d450acbe-0d23-4943-a48b-40ae6ff660bc	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_completed	hardware_job	2026074a-7218-4b58-88e1-a812455e58d8	{"jobStatus": "submitted", "attemptStatus": "submitted", "eventSequence": 3}	{"jobStatus": "completed", "disposition": "updated", "attemptStatus": "acknowledged", "eventSequence": 4}	\N	85bbf9bc-b3d5-4c4d-8fc6-24d14ec450c9:acknowledged:4	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "test_label_printer", "attemptId": "85bbf9bc-b3d5-4c4d-8fc6-24d14ec450c9", "errorCode": null, "retrySafe": null, "deviceType": "label_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-27T08:47:13.825Z", "protocolVersion": 2}	2026-07-27 08:47:15.006751+00
84e67359-e28d-4d72-96aa-e943b8435947	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	hardware.job_created	hardware_job	ff134bb9-f9c3-4113-8eb2-b65bd4c3588f	\N	{"status": "pending", "jobType": "test_document_printer", "sourceId": "4ec20130-c696-4b37-8e45-dbb7ed5a3050", "expiresAt": "2026-07-27T08:49:44.773Z", "sourceType": "hardware_test", "targetAgentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "protocolVersion": 2, "requiredCapability": "print_document_pdf"}	Menjalankan test document printer untuk agent TOKO-BG1.	4ec20130-c696-4b37-8e45-dbb7ed5a3050	\N	\N	{"source": "admin.hardware_dashboard", "payloadHash": "e19e025b64b2df516ec437b472fa5e2cc71e575cab6b6a35abdd450fcff7cad1", "creationMode": "test", "idempotencyKey": "hardware-test:4ec20130-c696-4b37-8e45-dbb7ed5a3050"}	2026-07-27 08:47:44.773+00
717b3b7b-ceac-41a6-84cd-03510fa6a4c8	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_dispatch_started	hardware_job	ff134bb9-f9c3-4113-8eb2-b65bd4c3588f	{"jobStatus": "processing", "attemptStatus": "processing", "eventSequence": 1}	{"jobStatus": "processing", "disposition": "updated", "attemptStatus": "dispatching", "eventSequence": 2}	\N	aacd71ca-b243-4a2c-a5be-63f48f1a7d42:dispatching:2	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "test_document_printer", "attemptId": "aacd71ca-b243-4a2c-a5be-63f48f1a7d42", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-27T08:47:52.201Z", "protocolVersion": 2}	2026-07-27 08:47:53.353037+00
e59d612b-849e-444d-a96f-2bd21691d218	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_submitted	hardware_job	ff134bb9-f9c3-4113-8eb2-b65bd4c3588f	{"jobStatus": "processing", "attemptStatus": "dispatching", "eventSequence": 2}	{"jobStatus": "submitted", "disposition": "updated", "attemptStatus": "submitted", "eventSequence": 3}	\N	aacd71ca-b243-4a2c-a5be-63f48f1a7d42:submitted:3	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "test_document_printer", "attemptId": "aacd71ca-b243-4a2c-a5be-63f48f1a7d42", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-27T08:47:53.370Z", "protocolVersion": 2}	2026-07-27 08:47:54.519849+00
9a8cb66f-f6d0-4f30-9a3a-f3aeee0f5980	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	hardware.job_completed	hardware_job	ff134bb9-f9c3-4113-8eb2-b65bd4c3588f	{"jobStatus": "submitted", "attemptStatus": "submitted", "eventSequence": 3}	{"jobStatus": "completed", "disposition": "updated", "attemptStatus": "acknowledged", "eventSequence": 4}	\N	aacd71ca-b243-4a2c-a5be-63f48f1a7d42:acknowledged:4	\N	\N	{"agentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "jobType": "test_document_printer", "attemptId": "aacd71ca-b243-4a2c-a5be-63f48f1a7d42", "errorCode": null, "retrySafe": null, "deviceType": "document_printer", "attemptNumber": 1, "agentOccurredAt": "2026-07-27T08:47:54.534Z", "protocolVersion": 2}	2026-07-27 08:47:55.619939+00
6d0bc752-4c0a-41c6-be43-ada0a6fb788a	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	auth.login	user	840c182b-642d-438d-b6ee-24f1e56833a3	\N	{"method": "password"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{}	2026-07-27 21:06:32.808461+00
2564cbbf-ee3c-4bdf-bdfa-bdaee8413259	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	840c182b-642d-438d-b6ee-24f1e56833a3	shift.close	shift	58c24186-e578-4f6b-91d4-5ebbc3bf0b64	{"status": "open", "expectedCash": "3727500"}	{"status": "closed", "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "actualCash": "3727500", "outletCode": "TOKO-BG", "outletName": "Bantar Gebang", "registerId": "36961177-52d1-45e7-ba0c-d1bf785ce2da", "cashSummary": {"cashIn": 0, "cashOut": 0, "cashSales": 3662500, "cashRefunds": 0, "expectedCash": 3727500, "movementCount": 2, "openingBalance": 65000, "closingAdjustments": 0}, "openingCash": "65000", "cashVariance": "0", "expectedCash": "3727500", "registerCode": "POS-BG1", "registerName": "Kasir Bantar Gebang 1", "varianceReason": null}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{"source": "admin.shift_dashboard", "closedAt": "2026-07-27T21:06:54.634Z"}	2026-07-27 21:06:54.634+00
e74cefa8-5aaf-4520-b098-9e2086d8afc6	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	auth.logout	user_session	08aa1454-625e-493e-83cf-9f948cfcb72a	\N	\N	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{}	2026-07-27 21:07:31.886275+00
d9944ee4-2ef6-4419-bdab-950cdb4ebcf4	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	auth.login	user	840c182b-642d-438d-b6ee-24f1e56833a3	\N	{"method": "password"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{}	2026-07-27 21:15:29.648907+00
4a40676b-8943-4774-8cec-d0f7746cfb53	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	auth.logout	user_session	bad91724-6c22-45ac-9fb6-34ab494e4233	\N	\N	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{}	2026-07-27 21:22:22.058955+00
bc8d0119-b1f5-4c0c-b940-ad3f9ddcb4f4	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	auth.login	user	840c182b-642d-438d-b6ee-24f1e56833a3	\N	{"method": "password"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{}	2026-07-27 21:22:27.669621+00
ec4b1cc7-8f1d-47fe-94c8-7e54e535783e	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	auth.logout	user_session	2ee86507-11c4-430d-be80-bdfe29893e61	\N	\N	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{}	2026-07-27 21:36:05.227409+00
6df4ed3b-6888-4be3-8c66-fdabdf8b41b9	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	840c182b-642d-438d-b6ee-24f1e56833a3	auth.login	user	840c182b-642d-438d-b6ee-24f1e56833a3	\N	{"method": "password"}	\N	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	{}	2026-07-27 21:36:06.907049+00
\.


--
-- Data for Name: cash_movements; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.cash_movements (id, shift_id, type, amount, reference_type, reference_id, reason, created_by, created_at) FROM stdin;
355c1bbb-52d4-4cbc-8bad-d1133663f707	3d4da573-4f97-4d7d-818d-69d53de29e24	opening_balance	500000	shift	3d4da573-4f97-4d7d-818d-69d53de29e24	Hanita: Shift pagi bantar gebang	840c182b-642d-438d-b6ee-24f1e56833a3	2026-07-22 18:33:44.801+00
8616f68e-585f-41a8-919b-28bb4e139d99	12a39630-334f-4567-a906-55daa8829c94	opening_balance	650000	shift	12a39630-334f-4567-a906-55daa8829c94	Hanita: Shift pagi bantar gebang	840c182b-642d-438d-b6ee-24f1e56833a3	2026-07-22 19:00:24.784+00
f847cc4a-c88e-4def-acd8-46da10706d2d	12a39630-334f-4567-a906-55daa8829c94	cash_sale	1287000	sale	b811bd6a-1e1a-4b1f-b3d3-738564db1116	Pembayaran cash transaksi AJ-TOKO-BG-20260723-8D52349C.	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	2026-07-22 19:01:12.762+00
6937800d-0530-426b-a114-a0595894eb3b	a0af43ba-c501-4f7b-987b-f71ca958c5cb	opening_balance	500000	shift	a0af43ba-c501-4f7b-987b-f71ca958c5cb	Shift pagi outlet bantar gebang	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	2026-07-22 19:11:47.81+00
732fd2b8-77e4-421a-9791-ab2af0741399	3d4da573-4f97-4d7d-818d-69d53de29e24	cash_sale	1812500	sale	a05177cf-aa7d-4258-8526-fb36c838dc50	Pembayaran cash transaksi AJ-TOKO-BG-20260723-755DB604.	840c182b-642d-438d-b6ee-24f1e56833a3	2026-07-22 23:17:50.666+00
f1e51f01-016d-4563-8ac2-5ad8ab2a588b	58c24186-e578-4f6b-91d4-5ebbc3bf0b64	opening_balance	65000	shift	58c24186-e578-4f6b-91d4-5ebbc3bf0b64	Hanita: Shift pagi bantar gebang	840c182b-642d-438d-b6ee-24f1e56833a3	2026-07-23 07:46:22.72+00
fc360381-1ea1-47f3-8e8f-ad3ada7b672c	58c24186-e578-4f6b-91d4-5ebbc3bf0b64	cash_sale	3662500	sale	baf96a0f-bf66-4fb2-8381-02a0b3e6f33d	Pembayaran cash transaksi AJ-TOKO-BG-20260723-3219EA91.	840c182b-642d-438d-b6ee-24f1e56833a3	2026-07-23 08:11:56.008+00
\.


--
-- Data for Name: customer_deposit_ledger; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.customer_deposit_ledger (id, organization_id, outlet_id, customer_id, sale_id, payment_id, cash_movement_id, approval_id, entry_type, direction, amount, balance_after, idempotency_key, reference_type, reference_id, description, metadata, created_by, occurred_at, created_at) FROM stdin;
2cbb2fa4-4f27-45c6-af16-6fa1f8c1c6fe	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	da5c8f1c-9d23-4085-ad57-f2d1cbed9fec	baf96a0f-bf66-4fb2-8381-02a0b3e6f33d	\N	\N	\N	deposit_in	credit	1600000	1600000	pos:pos_dfafc2ba-2314-4ae3-8ede-daa9548995ba:customer_deposit_in	sale	baf96a0f-bf66-4fb2-8381-02a0b3e6f33d	Dana Titip masuk dari transaksi AJ-TOKO-BG-20260723-3219EA91.	{"source": "pos.checkout", "totalAmount": "2062500", "invoiceNumber": "AJ-TOKO-BG-20260723-3219EA91", "discountAmount": "0", "subtotalAmount": "2062500", "externalPaymentDueAmount": "3662500"}	840c182b-642d-438d-b6ee-24f1e56833a3	2026-07-23 08:11:56.008+00	2026-07-23 08:11:56.008+00
98bf343e-0d00-47ba-a3af-4e05207cbb96	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	da5c8f1c-9d23-4085-ad57-f2d1cbed9fec	902fd7b7-e2c9-4acb-8b4b-caa515a84592	\N	\N	\N	deposit_used	debit	1450000	150000	pos:pos_db56dd2d-0d35-418f-8b5d-1be726a66a4d:customer_deposit_used	sale	902fd7b7-e2c9-4acb-8b4b-caa515a84592	Dana Titip digunakan untuk transaksi AJ-TOKO-BG-20260723-D2B23D66.	{"source": "pos.checkout", "totalAmount": "1450000", "invoiceNumber": "AJ-TOKO-BG-20260723-D2B23D66", "discountAmount": "0", "subtotalAmount": "1450000", "externalPaymentDueAmount": "0"}	840c182b-642d-438d-b6ee-24f1e56833a3	2026-07-23 08:13:19.384+00	2026-07-23 08:13:19.384+00
\.


--
-- Data for Name: customer_history_credentials; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.customer_history_credentials (id, organization_id, customer_id, pin_hash, credential_version, must_change_pin, is_active, failed_attempt_count, failed_window_started_at, locked_until, pin_created_at, pin_reset_at, pin_created_by_user_id, last_successful_access_at, created_at, updated_at) FROM stdin;
e5a80c83-c371-466b-9025-c06d6c6a576b	3f964ae0-a43e-420b-95db-d5350d8ce754	da5c8f1c-9d23-4085-ad57-f2d1cbed9fec	scrypt$32768$8$3$Myzqq8HZ9wjOGsXeqkJPhA$cL1j8_32y9kPrGUbin16R4zcMYuGXVIXxzpIJY8MAAA_tHXYbEG0qUq8Mk41OQxOgF1PZtRh8nOGT96tINeeaw	2	f	t	0	\N	\N	2026-07-27 06:17:55.181+00	2026-07-27 06:19:01.525+00	840c182b-642d-438d-b6ee-24f1e56833a3	2026-07-27 06:18:39.551+00	2026-07-27 06:17:55.181+00	2026-07-27 06:19:01.525+00
\.


--
-- Data for Name: customer_history_ip_rate_limits; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.customer_history_ip_rate_limits (id, key_hash, window_started_at, failure_count, blocked_until, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_history_sessions; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.customer_history_sessions (id, organization_id, customer_id, credential_version, token_hash, requires_pin_change, absolute_expires_at, idle_expires_at, last_seen_at, revoked_at, ip_address, user_agent, created_at, updated_at) FROM stdin;
edf5b490-7a95-4d95-925f-25812b8c6954	3f964ae0-a43e-420b-95db-d5350d8ce754	da5c8f1c-9d23-4085-ad57-f2d1cbed9fec	1	8f1acee2c2ff72d56d6bcb500d82d46b812c5933995d104aa08bf0aaf4625128	t	2026-07-27 06:28:39.555+00	2026-07-27 06:28:39.555+00	2026-07-27 06:18:39.555+00	2026-07-27 06:19:01.525+00	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	2026-07-27 06:18:39.555+00	2026-07-27 06:19:01.525+00
93ccc11a-7e5b-4bbd-86fb-321327bc6fc4	3f964ae0-a43e-420b-95db-d5350d8ce754	da5c8f1c-9d23-4085-ad57-f2d1cbed9fec	2	d062926490db3ec0a5757c47407d8679fe36bcde1b7a1ed3b8b5a4d7d62e7aa7	f	2026-07-27 10:19:01.534+00	2026-07-27 06:49:01.572+00	2026-07-27 06:19:01.572+00	2026-07-27 06:19:12.441+00	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	2026-07-27 06:19:01.534+00	2026-07-27 06:19:12.441+00
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.customers (id, organization_id, customer_code, full_name, phone, email, address, notes, is_active, created_at, updated_at) FROM stdin;
da5c8f1c-9d23-4085-ad57-f2d1cbed9fec	3f964ae0-a43e-420b-95db-d5350d8ce754	CUST-20260723-04F7E805	Siti Aminah	081234567868	sitiaminah87@gmail.com	Jl.Salemba Utan Barat, Matraman - Jakarta Timur	suka model simple, dan dia selalu respon follow-up di WA setiap hari minggu sore hari	t	2026-07-22 18:48:45.855+00	2026-07-22 18:48:45.855+00
\.


--
-- Data for Name: hardware_agents; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.hardware_agents (id, organization_id, outlet_id, register_id, code, name, secret_hash, status, is_active, capabilities, settings, last_seen_at, last_ip_address, last_user_agent, created_at, updated_at) FROM stdin;
561378c4-6bcf-4dbe-9023-80ebd00e9bdc	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	TOKO-BG1	Kasir Bantar Gebang 1	hws2.VEhfzXPvgd19EUE2.wPc_v8mUZGt3ap8SLmI3Bk-cLWu2igFpkAV2UZ0rOxJuxBAUJ1HYo5hLWYrWMURjpyHHOk7czPypBd96yRIwdg.j6lxqvnrB8K0GoIzVijm0Q	offline	t	{"arch": "x64", "dry_run": false, "hostname": "DESKTOP-QDH2VQ0", "platform": "win32", "operations": {"process_lock": true, "structured_logs": true, "health_server_host": "127.0.0.1", "health_server_port": 3210, "log_retention_days": 30, "health_server_enabled": true}, "label_config": {"copies": 1, "darkness": "4", "print_speed": "4", "template_id": "jewelry_compact_v1", "include_price": false, "media_width_dots": "400", "media_height_dots": "300", "printer_profile_id": "sato_cg408tt_jewelry_v1", "physical_validation": "pending", "vertical_offset_dots": 0, "horizontal_offset_dots": 0}, "node_version": "v24.14.0", "adapter_modes": {"cash_drawer": "fake", "label_printer": "fake", "document_printer": "fake"}, "agent_version": "2.5.0-request-signing", "fake_hardware": {"delayMs": 250, "enabled": true, "planPath": null, "outputDir": "C:\\\\Users\\\\Misifiksi\\\\Desktop\\\\asihjaya-rms\\\\hardware-hub\\\\data\\\\fake-output", "defaultScenario": "success", "deviceScenarios": {}, "supportedScenarios": ["success", "fail_before_dispatch", "timeout_before_dispatch", "printer_not_found", "slow_execution", "unknown_after_dispatch", "crash_after_dispatch", "success_then_ack_lost"]}, "local_journal": {"path": "C:\\\\Users\\\\Misifiksi\\\\Desktop\\\\asihjaya-rms\\\\hardware-hub\\\\data\\\\hardware-executions.sqlite", "stats": {"acknowledged": 11, "failed_before_dispatch": 3, "unknown_after_dispatch": 16}, "enabled": true, "secretProtector": {"kind": "windows-dpapi-current-user", "healthy": true, "testedAt": "2026-07-27T21:22:03.027Z"}}, "protocol_mode": "v2-preferred", "config_warnings": [], "open_cash_drawer": true, "poll_interval_ms": 2000, "print_label_sato": true, "protocol_version": 2, "configured_devices": {"label_printer": true, "document_printer": true, "cash_drawer_printer": true, "pdf_print_executable": true, "pdf_print_command_legacy": false}, "print_document_pdf": true, "request_timeout_ms": 15000, "heartbeat_interval_ms": 30000, "lease_renew_interval_ms": 20000, "print_command_timeout_ms": 60000, "print_receipt_certificate": true}	{}	2026-07-27 21:37:09.495+00	::1	\N	2026-07-22 18:32:21.572398+00	2026-07-27 21:37:09.495+00
\.


--
-- Data for Name: hardware_job_attempts; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.hardware_job_attempts (id, job_id, agent_id, attempt_number, status, lease_token_hash, lease_expires_at, payload_hash, event_sequence, dispatch_started_at, submitted_at, server_acknowledged_at, finished_at, error_code, error_message, retry_safe, result, created_at, updated_at) FROM stdin;
c69afe97-223e-43c4-b523-fdae43d98445	e7194c28-34dd-4545-89f7-b90faf7411af	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	1	acknowledged	c830f4ad31b8ee7108a466993a6ea13f85fb82730694a45c130ee75683c981c0	2026-07-22 22:59:15.646+00	bcaad165658891ae40be5eb86116e840795bb43a3b1a1044b067659e58294575	4	2026-07-22 22:58:23.148+00	2026-07-22 22:58:24.748+00	2026-07-22 22:58:24.748+00	2026-07-22 22:58:26.175+00	\N	\N	\N	{"dryRun": false, "jobType": "test_document_printer", "deviceType": "document_printer", "payloadHash": "bcaad165658891ae40be5eb86116e840795bb43a3b1a1044b067659e58294575", "submittedAt": "2026-07-22T22:58:23.414Z", "agentVersion": "2.4.0-pr10-outlet-readiness", "acknowledgedAt": "2026-07-22T22:58:24.982Z", "idempotencyKey": "c69afe97-223e-43c4-b523-fdae43d98445:acknowledged:4", "agentOccurredAt": "2026-07-22T22:58:24.982Z"}	2026-07-22 22:58:15.88223+00	2026-07-22 22:58:26.175+00
be6437c8-0cce-4a8d-ac33-096ff3429e97	a0e5b01d-b045-4840-903b-29e552610b60	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	1	acknowledged	adf65223a865d3c076af27a40f9dad2258da7f7b9c7bb704c40bf9c64315603c	2026-07-23 08:52:20.057+00	08c1d68e9735317950669a08809529a02baef9b3951a3b3b9721b62a775e3ad9	4	2026-07-23 08:51:33.036+00	2026-07-23 08:51:34.445+00	2026-07-23 08:51:34.445+00	2026-07-23 08:51:35.919+00	\N	\N	\N	{"dryRun": false, "jobType": "print_receipt_certificate", "deviceType": "document_printer", "payloadHash": "08c1d68e9735317950669a08809529a02baef9b3951a3b3b9721b62a775e3ad9", "submittedAt": "2026-07-23T08:51:33.272Z", "agentVersion": "2.4.0-pr10-outlet-readiness", "acknowledgedAt": "2026-07-23T08:51:34.674Z", "idempotencyKey": "be6437c8-0cce-4a8d-ac33-096ff3429e97:acknowledged:4", "agentOccurredAt": "2026-07-23T08:51:34.674Z"}	2026-07-23 08:51:20.286872+00	2026-07-23 08:51:35.919+00
6d1d8c96-4551-4679-a3b1-a20b364089ce	2156f63c-0e7d-4131-b8d2-89b55ca8c8a7	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	1	acknowledged	34a3314ac90c47de8a18122deff94be85a5c2b5fea40aa46adb6bb4e26a36835	2026-07-23 08:52:38.167+00	237031bb94eed9274ed25261ecdd94f70718aa95d684145c001ecfe6365dd5dd	4	2026-07-23 08:51:44.156+00	2026-07-23 08:51:45.607+00	2026-07-23 08:51:45.607+00	2026-07-23 08:51:47.004+00	\N	\N	\N	{"dryRun": false, "jobType": "print_receipt_certificate", "deviceType": "document_printer", "payloadHash": "237031bb94eed9274ed25261ecdd94f70718aa95d684145c001ecfe6365dd5dd", "submittedAt": "2026-07-23T08:51:44.429Z", "agentVersion": "2.4.0-pr10-outlet-readiness", "acknowledgedAt": "2026-07-23T08:51:45.821Z", "idempotencyKey": "6d1d8c96-4551-4679-a3b1-a20b364089ce:acknowledged:4", "agentOccurredAt": "2026-07-23T08:51:45.821Z"}	2026-07-23 08:51:38.38311+00	2026-07-23 08:51:47.004+00
897c09af-d857-4ff8-8e15-a912fc95d228	b6104d08-604b-4612-a2f0-d60228c27da3	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	1	acknowledged	4219f557db121189748aae984863d514a85572195f74e84e0606583fdbc49e42	2026-07-23 08:54:03.853+00	e8dfc3bdd0683f9274f04ee6c8c32f37a8fd8ade97d98fba14ca57869bb71e14	4	2026-07-23 08:53:09.683+00	2026-07-23 08:53:11.196+00	2026-07-23 08:53:11.196+00	2026-07-23 08:53:12.602+00	\N	\N	\N	{"dryRun": false, "jobType": "print_receipt_certificate", "deviceType": "document_printer", "payloadHash": "e8dfc3bdd0683f9274f04ee6c8c32f37a8fd8ade97d98fba14ca57869bb71e14", "submittedAt": "2026-07-23T08:53:09.926Z", "agentVersion": "2.4.0-pr10-outlet-readiness", "acknowledgedAt": "2026-07-23T08:53:11.427Z", "idempotencyKey": "897c09af-d857-4ff8-8e15-a912fc95d228:acknowledged:4", "agentOccurredAt": "2026-07-23T08:53:11.427Z"}	2026-07-23 08:53:04.099159+00	2026-07-23 08:53:12.602+00
3823bcc8-b7fa-4c8f-bfa3-8a0b0b8c67d9	1d6b2f65-f8aa-4c5e-961a-d97bdaa1052c	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	1	acknowledged	e86214b8d64dad00c77d58fcedf39c036f271890c912693dd02502f7693bf610	2026-07-26 09:55:33.43+00	00762507d4aa4edd7f309b7262a88aa4111f452a0f6d6fc26b3d13dfb44a2b40	4	2026-07-26 09:54:40.272+00	2026-07-26 09:54:41.61+00	2026-07-26 09:54:41.61+00	2026-07-26 09:54:42.873+00	\N	\N	\N	{"dryRun": false, "jobType": "print_receipt_certificate", "deviceType": "document_printer", "payloadHash": "00762507d4aa4edd7f309b7262a88aa4111f452a0f6d6fc26b3d13dfb44a2b40", "submittedAt": "2026-07-26T09:54:40.513Z", "agentVersion": "2.4.0-pr10-outlet-readiness", "acknowledgedAt": "2026-07-26T09:54:41.820Z", "idempotencyKey": "3823bcc8-b7fa-4c8f-bfa3-8a0b0b8c67d9:acknowledged:4", "agentOccurredAt": "2026-07-26T09:54:41.821Z"}	2026-07-26 09:54:33.654534+00	2026-07-26 09:54:42.873+00
7939ace8-097f-417c-a766-acba6d129689	fb90cb13-6752-40c1-b9b9-f6e7e54e7cf4	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	1	acknowledged	465d5b6b07a7e3a1228e95b571dec28ed6498be4e821fd23095595f2c9ae7ea9	2026-07-27 07:09:01.548+00	22da68121a22e05c8dd8473593413beacdd365294d7032f56d6d87bf484ffb2c	4	2026-07-27 07:08:07.726+00	2026-07-27 07:08:09.085+00	2026-07-27 07:08:09.085+00	2026-07-27 07:08:10.452+00	\N	\N	\N	{"dryRun": false, "jobType": "print_receipt_certificate", "deviceType": "document_printer", "payloadHash": "22da68121a22e05c8dd8473593413beacdd365294d7032f56d6d87bf484ffb2c", "submittedAt": "2026-07-27T07:08:07.951Z", "agentVersion": "2.4.0-pr10-outlet-readiness", "acknowledgedAt": "2026-07-27T07:08:09.307Z", "idempotencyKey": "7939ace8-097f-417c-a766-acba6d129689:acknowledged:4", "agentOccurredAt": "2026-07-27T07:08:09.307Z"}	2026-07-27 07:08:01.778098+00	2026-07-27 07:08:10.452+00
cf7eac61-cb18-4756-b133-2a5c60e4c56d	5ac1e68a-d200-40e9-94d1-ee09fd2324fb	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	1	acknowledged	e178ab08ac8b434ce842b5d8235a22c2c14be8942b626441451398a863f983a4	2026-07-27 08:44:06.051+00	360de122226a2ff783861464469739a320fc969342768075a155d8638e41606d	4	2026-07-27 08:43:12.991+00	2026-07-27 08:43:14.338+00	2026-07-27 08:43:14.338+00	2026-07-27 08:43:15.473+00	\N	\N	\N	{"dryRun": false, "jobType": "print_receipt_certificate", "deviceType": "document_printer", "payloadHash": "360de122226a2ff783861464469739a320fc969342768075a155d8638e41606d", "submittedAt": "2026-07-27T08:43:13.014Z", "agentVersion": "2.5.0-request-signing", "acknowledgedAt": "2026-07-27T08:43:14.359Z", "idempotencyKey": "cf7eac61-cb18-4756-b133-2a5c60e4c56d:acknowledged:4", "agentOccurredAt": "2026-07-27T08:43:14.359Z"}	2026-07-27 08:43:06.071203+00	2026-07-27 08:43:15.473+00
85bbf9bc-b3d5-4c4d-8fc6-24d14ec450c9	2026074a-7218-4b58-88e1-a812455e58d8	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	1	acknowledged	5daf9683e5b43527d5541a53e6d5d430becc4b438780090bfcdcae8e85939de8	2026-07-27 08:48:08.35+00	eded3ede48625ae189d217979121d1bd6407dcbe428839698a12f74629b9186d	4	2026-07-27 08:47:12.639+00	2026-07-27 08:47:13.805+00	2026-07-27 08:47:13.805+00	2026-07-27 08:47:15.003+00	\N	\N	\N	{"dryRun": false, "jobType": "test_label_printer", "deviceType": "label_printer", "payloadHash": "eded3ede48625ae189d217979121d1bd6407dcbe428839698a12f74629b9186d", "submittedAt": "2026-07-27T08:47:12.658Z", "agentVersion": "2.5.0-request-signing", "acknowledgedAt": "2026-07-27T08:47:13.825Z", "idempotencyKey": "85bbf9bc-b3d5-4c4d-8fc6-24d14ec450c9:acknowledged:4", "agentOccurredAt": "2026-07-27T08:47:13.825Z"}	2026-07-27 08:47:08.457+00	2026-07-27 08:47:15.003+00
aacd71ca-b243-4a2c-a5be-63f48f1a7d42	ff134bb9-f9c3-4113-8eb2-b65bd4c3588f	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	1	acknowledged	3c48deaec43f30315c2d63bc97dc96d71a191dd1d49540244c0d7470ca00e29e	2026-07-27 08:48:45.904+00	e19e025b64b2df516ec437b472fa5e2cc71e575cab6b6a35abdd450fcff7cad1	4	2026-07-27 08:47:53.348+00	2026-07-27 08:47:54.515+00	2026-07-27 08:47:54.515+00	2026-07-27 08:47:55.616+00	\N	\N	\N	{"dryRun": false, "jobType": "test_document_printer", "deviceType": "document_printer", "payloadHash": "e19e025b64b2df516ec437b472fa5e2cc71e575cab6b6a35abdd450fcff7cad1", "submittedAt": "2026-07-27T08:47:53.370Z", "agentVersion": "2.5.0-request-signing", "acknowledgedAt": "2026-07-27T08:47:54.534Z", "idempotencyKey": "aacd71ca-b243-4a2c-a5be-63f48f1a7d42:acknowledged:4", "agentOccurredAt": "2026-07-27T08:47:54.534Z"}	2026-07-27 08:47:45.913857+00	2026-07-27 08:47:55.616+00
\.


--
-- Data for Name: hardware_job_resolutions; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.hardware_job_resolutions (id, organization_id, outlet_id, job_id, attempt_id, resolved_by_user_id, resolution_type, reason, duplicate_risk_acknowledged, previous_status, next_status, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: hardware_jobs; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.hardware_jobs (id, organization_id, outlet_id, register_id, agent_id, target_agent_id, current_attempt_id, created_by_user_id, protocol_version, job_type, device_type, required_capability, target_device, status, priority, attempts, max_attempts, payload, payload_hash, result, error, last_error_code, last_error_message, idempotency_key, source_type, source_id, available_at, expires_at, claimed_at, started_at, processing_at, submitted_at, completed_at, failed_at, unknown_at, expired_at, cancelled_at, created_at, updated_at) FROM stdin;
2f2f73fd-aa06-4be9-b941-455f01d6cca4	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	066908eb-8d08-4676-a136-197b9af1a7fc	\N	\N	\N	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	2	print_receipt_certificate	document_printer	print_document_pdf	document_printer	cancelled	30	0	2	{"copies": 1, "download": {"path": "/api/sales/b811bd6a-1e1a-4b1f-b3d3-738564db1116/receipt-certificate?profile=receipt_a4_landscape_v1", "maxBytes": 10485760, "contentType": "application/pdf"}, "metadata": {"reprint": false, "requestedAt": "2026-07-22T19:01:12.762Z", "invoiceNumber": "AJ-TOKO-BG-20260723-8D52349C", "requestSource": "pos.checkout"}, "documentId": "b811bd6a-1e1a-4b1f-b3d3-738564db1116", "documentType": "receipt_certificate", "schemaVersion": 1, "printProfileId": "epson_l3251_a4_v1", "documentProfileId": "receipt_a4_landscape_v1"}	5fefc10c9da9b64d112b5b7f25d92eb0489531399b9c736f84cf15e55c6fa4f2	{"cancelledAt": "2026-07-22T19:08:27.897Z", "cancelledByUserId": "840c182b-642d-438d-b6ee-24f1e56833a3"}	Dibatalkan manual dari dashboard Hardware Hub.	\N	\N	receipt:b811bd6a-1e1a-4b1f-b3d3-738564db1116:initial	sale	b811bd6a-1e1a-4b1f-b3d3-738564db1116	2026-07-22 19:01:12.762+00	2026-07-22 23:01:12.762+00	\N	\N	\N	\N	\N	\N	\N	\N	2026-07-22 19:08:27.897+00	2026-07-22 19:01:12.762+00	2026-07-22 19:08:27.897+00
e7194c28-34dd-4545-89f7-b90faf7411af	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	c69afe97-223e-43c4-b523-fdae43d98445	840c182b-642d-438d-b6ee-24f1e56833a3	2	test_document_printer	document_printer	print_document_pdf	document_printer	completed	20	1	1	{"copies": 1, "download": {"path": "/api/sales/receipt-certificate-preview?profile=receipt_a4_landscape_v1", "maxBytes": 10485760, "contentType": "application/pdf"}, "metadata": {"reprint": false, "requestedAt": "2026-07-22T22:58:14.508Z", "requestSource": "admin.hardware_test"}, "documentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "documentType": "hardware_test_document", "schemaVersion": 1, "printProfileId": "epson_l3251_a4_v1", "documentProfileId": "receipt_a4_landscape_v1"}	bcaad165658891ae40be5eb86116e840795bb43a3b1a1044b067659e58294575	{"dryRun": false, "jobType": "test_document_printer", "deviceType": "document_printer", "payloadHash": "bcaad165658891ae40be5eb86116e840795bb43a3b1a1044b067659e58294575", "submittedAt": "2026-07-22T22:58:23.414Z", "agentVersion": "2.4.0-pr10-outlet-readiness", "acknowledgedAt": "2026-07-22T22:58:24.982Z"}	\N	\N	\N	hardware-test:83f767eb-284a-4591-9a5f-1853ade35eae	hardware_test	83f767eb-284a-4591-9a5f-1853ade35eae	2026-07-22 22:58:14.508+00	2026-07-22 23:00:14.508+00	2026-07-22 22:58:15.646+00	2026-07-22 22:58:23.148+00	2026-07-22 22:58:19.156+00	2026-07-22 22:58:24.748+00	2026-07-22 22:58:26.175+00	\N	\N	\N	\N	2026-07-22 22:58:14.508+00	2026-07-22 22:58:26.175+00
e7c922fc-37ed-4431-b70c-0ab3bc7a41fd	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	\N	\N	840c182b-642d-438d-b6ee-24f1e56833a3	2	print_receipt_certificate	document_printer	print_document_pdf	document_printer	claimed	30	1	2	{"copies": 1, "download": {"path": "/api/sales/a05177cf-aa7d-4258-8526-fb36c838dc50/receipt-certificate?profile=receipt_a4_landscape_v1", "maxBytes": 10485760, "contentType": "application/pdf"}, "metadata": {"reprint": false, "requestedAt": "2026-07-22T23:17:50.666Z", "invoiceNumber": "AJ-TOKO-BG-20260723-755DB604", "requestSource": "pos.checkout"}, "documentId": "a05177cf-aa7d-4258-8526-fb36c838dc50", "documentType": "receipt_certificate", "schemaVersion": 1, "printProfileId": "epson_l3251_a4_v1", "documentProfileId": "receipt_a4_landscape_v1"}	003475b926c0fc778c2ea654246eae6e348ca07e093145c67d3973a4ddbcb8a6	{}	\N	\N	\N	receipt:a05177cf-aa7d-4258-8526-fb36c838dc50:initial	sale	a05177cf-aa7d-4258-8526-fb36c838dc50	2026-07-22 23:17:50.666+00	2026-07-23 03:17:50.666+00	2026-07-22 23:17:50.911+00	\N	\N	\N	\N	\N	\N	\N	\N	2026-07-22 23:17:50.666+00	2026-07-22 23:17:50.911+00
2156f63c-0e7d-4131-b8d2-89b55ca8c8a7	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	\N	6d1d8c96-4551-4679-a3b1-a20b364089ce	840c182b-642d-438d-b6ee-24f1e56833a3	2	print_receipt_certificate	document_printer	print_document_pdf	document_printer	completed	30	1	2	{"copies": 1, "download": {"path": "/api/sales/902fd7b7-e2c9-4acb-8b4b-caa515a84592/receipt-certificate?profile=receipt_a4_landscape_v1", "maxBytes": 10485760, "contentType": "application/pdf"}, "metadata": {"reprint": false, "requestedAt": "2026-07-23T08:13:19.384Z", "invoiceNumber": "AJ-TOKO-BG-20260723-D2B23D66", "requestSource": "pos.checkout"}, "documentId": "902fd7b7-e2c9-4acb-8b4b-caa515a84592", "documentType": "receipt_certificate", "schemaVersion": 1, "printProfileId": "epson_l3251_a4_v1", "documentProfileId": "receipt_a4_landscape_v1"}	237031bb94eed9274ed25261ecdd94f70718aa95d684145c001ecfe6365dd5dd	{"dryRun": false, "jobType": "print_receipt_certificate", "deviceType": "document_printer", "payloadHash": "237031bb94eed9274ed25261ecdd94f70718aa95d684145c001ecfe6365dd5dd", "submittedAt": "2026-07-23T08:51:44.429Z", "agentVersion": "2.4.0-pr10-outlet-readiness", "acknowledgedAt": "2026-07-23T08:51:45.821Z"}	\N	\N	\N	receipt:902fd7b7-e2c9-4acb-8b4b-caa515a84592:initial	sale	902fd7b7-e2c9-4acb-8b4b-caa515a84592	2026-07-23 08:13:19.384+00	2026-07-23 12:13:19.384+00	2026-07-23 08:51:38.167+00	2026-07-23 08:51:44.156+00	2026-07-23 08:51:40.934+00	2026-07-23 08:51:45.607+00	2026-07-23 08:51:47.004+00	\N	\N	\N	\N	2026-07-23 08:13:19.384+00	2026-07-23 08:51:47.004+00
a0e5b01d-b045-4840-903b-29e552610b60	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	\N	be6437c8-0cce-4a8d-ac33-096ff3429e97	840c182b-642d-438d-b6ee-24f1e56833a3	2	print_receipt_certificate	document_printer	print_document_pdf	document_printer	completed	30	1	2	{"copies": 1, "download": {"path": "/api/sales/baf96a0f-bf66-4fb2-8381-02a0b3e6f33d/receipt-certificate?profile=receipt_a4_landscape_v1", "maxBytes": 10485760, "contentType": "application/pdf"}, "metadata": {"reprint": false, "requestedAt": "2026-07-23T08:11:56.008Z", "invoiceNumber": "AJ-TOKO-BG-20260723-3219EA91", "requestSource": "pos.checkout"}, "documentId": "baf96a0f-bf66-4fb2-8381-02a0b3e6f33d", "documentType": "receipt_certificate", "schemaVersion": 1, "printProfileId": "epson_l3251_a4_v1", "documentProfileId": "receipt_a4_landscape_v1"}	08c1d68e9735317950669a08809529a02baef9b3951a3b3b9721b62a775e3ad9	{"dryRun": false, "jobType": "print_receipt_certificate", "deviceType": "document_printer", "payloadHash": "08c1d68e9735317950669a08809529a02baef9b3951a3b3b9721b62a775e3ad9", "submittedAt": "2026-07-23T08:51:33.272Z", "agentVersion": "2.4.0-pr10-outlet-readiness", "acknowledgedAt": "2026-07-23T08:51:34.674Z"}	\N	\N	\N	receipt:baf96a0f-bf66-4fb2-8381-02a0b3e6f33d:initial	sale	baf96a0f-bf66-4fb2-8381-02a0b3e6f33d	2026-07-23 08:11:56.008+00	2026-07-23 12:11:56.008+00	2026-07-23 08:51:20.057+00	2026-07-23 08:51:33.036+00	2026-07-23 08:51:23.49+00	2026-07-23 08:51:34.445+00	2026-07-23 08:51:35.919+00	\N	\N	\N	\N	2026-07-23 08:11:56.008+00	2026-07-23 08:51:35.919+00
09355cc5-f38b-4d47-ba1e-178e4d336c87	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	\N	\N	840c182b-642d-438d-b6ee-24f1e56833a3	2	print_receipt_certificate	document_printer	print_document_pdf	document_printer	claimed	25	1	2	{"copies": 1, "download": {"path": "/api/sales/a05177cf-aa7d-4258-8526-fb36c838dc50/receipt-certificate?profile=receipt_a4_landscape_v1", "maxBytes": 10485760, "contentType": "application/pdf"}, "metadata": {"reprint": true, "requestedAt": "2026-07-23T08:55:08.114Z", "invoiceNumber": "AJ-TOKO-BG-20260723-755DB604", "requestSource": "pos.transaction_detail"}, "documentId": "a05177cf-aa7d-4258-8526-fb36c838dc50", "documentType": "receipt_certificate", "schemaVersion": 1, "printProfileId": "epson_l3251_a4_v1", "documentProfileId": "receipt_a4_landscape_v1"}	fbf5efe046f9c5f2cd5f8928408de01edc180b3d51adc36704d8aa74b243c0d0	{}	\N	\N	\N	receipt:a05177cf-aa7d-4258-8526-fb36c838dc50:reprint:da839ad3-79f0-4ec6-a77c-ec18e14a9504	sale	a05177cf-aa7d-4258-8526-fb36c838dc50	2026-07-23 08:55:08.114+00	2026-07-23 16:55:08.114+00	2026-07-23 08:55:08.132+00	\N	\N	\N	\N	\N	\N	\N	\N	2026-07-23 08:55:08.114+00	2026-07-23 08:55:08.132+00
b6104d08-604b-4612-a2f0-d60228c27da3	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	\N	897c09af-d857-4ff8-8e15-a912fc95d228	840c182b-642d-438d-b6ee-24f1e56833a3	2	print_receipt_certificate	document_printer	print_document_pdf	document_printer	completed	25	1	2	{"copies": 1, "download": {"path": "/api/sales/baf96a0f-bf66-4fb2-8381-02a0b3e6f33d/receipt-certificate?profile=receipt_a4_landscape_v1", "maxBytes": 10485760, "contentType": "application/pdf"}, "metadata": {"reprint": true, "requestedAt": "2026-07-23T08:53:03.193Z", "invoiceNumber": "AJ-TOKO-BG-20260723-3219EA91", "requestSource": "admin.sales.detail"}, "documentId": "baf96a0f-bf66-4fb2-8381-02a0b3e6f33d", "documentType": "receipt_certificate", "schemaVersion": 1, "printProfileId": "epson_l3251_a4_v1", "documentProfileId": "receipt_a4_landscape_v1"}	e8dfc3bdd0683f9274f04ee6c8c32f37a8fd8ade97d98fba14ca57869bb71e14	{"dryRun": false, "jobType": "print_receipt_certificate", "deviceType": "document_printer", "payloadHash": "e8dfc3bdd0683f9274f04ee6c8c32f37a8fd8ade97d98fba14ca57869bb71e14", "submittedAt": "2026-07-23T08:53:09.926Z", "agentVersion": "2.4.0-pr10-outlet-readiness", "acknowledgedAt": "2026-07-23T08:53:11.427Z"}	\N	\N	\N	receipt:baf96a0f-bf66-4fb2-8381-02a0b3e6f33d:reprint:76b884f3-c310-4e75-a021-a777341cd1c3	sale	baf96a0f-bf66-4fb2-8381-02a0b3e6f33d	2026-07-23 08:53:03.193+00	2026-07-23 16:53:03.193+00	2026-07-23 08:53:03.853+00	2026-07-23 08:53:09.683+00	2026-07-23 08:53:06.581+00	2026-07-23 08:53:11.196+00	2026-07-23 08:53:12.602+00	\N	\N	\N	\N	2026-07-23 08:53:03.193+00	2026-07-23 08:53:12.602+00
c2a143b9-9bf8-4645-97a4-0735f3266300	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	\N	\N	840c182b-642d-438d-b6ee-24f1e56833a3	2	print_receipt_certificate	document_printer	print_document_pdf	document_printer	claimed	25	1	2	{"copies": 1, "download": {"path": "/api/sales/902fd7b7-e2c9-4acb-8b4b-caa515a84592/receipt-certificate?profile=receipt_a4_landscape_v1&mode=preprinted_overlay", "maxBytes": 10485760, "contentType": "application/pdf"}, "metadata": {"reprint": true, "renderMode": "preprinted_overlay", "requestedAt": "2026-07-26T09:54:09.563Z", "invoiceNumber": "AJ-TOKO-BG-20260723-D2B23D66", "requestSource": "admin.sales.detail"}, "documentId": "902fd7b7-e2c9-4acb-8b4b-caa515a84592", "documentType": "receipt_certificate", "schemaVersion": 1, "printProfileId": "epson_l3251_a4_v1", "documentProfileId": "receipt_a4_landscape_v1"}	7b80a5eaec53c02a7bb397256cb73f06cc108ec8c42709eb0f076eee63f14934	{}	\N	\N	\N	receipt:902fd7b7-e2c9-4acb-8b4b-caa515a84592:reprint:3b2f5a40-18d6-4491-89e5-b31be351a656	sale	902fd7b7-e2c9-4acb-8b4b-caa515a84592	2026-07-26 09:54:09.563+00	2026-07-26 17:54:09.563+00	2026-07-26 09:54:09.78+00	\N	\N	\N	\N	\N	\N	\N	\N	2026-07-26 09:54:09.563+00	2026-07-26 09:54:09.78+00
1d6b2f65-f8aa-4c5e-961a-d97bdaa1052c	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	\N	3823bcc8-b7fa-4c8f-bfa3-8a0b0b8c67d9	840c182b-642d-438d-b6ee-24f1e56833a3	2	print_receipt_certificate	document_printer	print_document_pdf	document_printer	completed	25	1	2	{"copies": 1, "download": {"path": "/api/sales/902fd7b7-e2c9-4acb-8b4b-caa515a84592/receipt-certificate?profile=receipt_a4_landscape_v1&mode=preprinted_overlay", "maxBytes": 10485760, "contentType": "application/pdf"}, "metadata": {"reprint": true, "renderMode": "preprinted_overlay", "requestedAt": "2026-07-26T09:54:32.976Z", "invoiceNumber": "AJ-TOKO-BG-20260723-D2B23D66", "requestSource": "admin.sales.detail"}, "documentId": "902fd7b7-e2c9-4acb-8b4b-caa515a84592", "documentType": "receipt_certificate", "schemaVersion": 1, "printProfileId": "epson_l3251_a4_v1", "documentProfileId": "receipt_a4_landscape_v1"}	00762507d4aa4edd7f309b7262a88aa4111f452a0f6d6fc26b3d13dfb44a2b40	{"dryRun": false, "jobType": "print_receipt_certificate", "deviceType": "document_printer", "payloadHash": "00762507d4aa4edd7f309b7262a88aa4111f452a0f6d6fc26b3d13dfb44a2b40", "submittedAt": "2026-07-26T09:54:40.513Z", "agentVersion": "2.4.0-pr10-outlet-readiness", "acknowledgedAt": "2026-07-26T09:54:41.820Z"}	\N	\N	\N	receipt:902fd7b7-e2c9-4acb-8b4b-caa515a84592:reprint:e553ef92-d692-4fe3-a716-09f6da2cd35d	sale	902fd7b7-e2c9-4acb-8b4b-caa515a84592	2026-07-26 09:54:32.976+00	2026-07-26 17:54:32.976+00	2026-07-26 09:54:33.43+00	2026-07-26 09:54:40.272+00	2026-07-26 09:54:36.577+00	2026-07-26 09:54:41.61+00	2026-07-26 09:54:42.873+00	\N	\N	\N	\N	2026-07-26 09:54:32.976+00	2026-07-26 09:54:42.873+00
fb90cb13-6752-40c1-b9b9-f6e7e54e7cf4	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	\N	7939ace8-097f-417c-a766-acba6d129689	840c182b-642d-438d-b6ee-24f1e56833a3	2	print_receipt_certificate	document_printer	print_document_pdf	document_printer	completed	25	1	2	{"copies": 1, "download": {"path": "/api/sales/902fd7b7-e2c9-4acb-8b4b-caa515a84592/receipt-certificate?profile=receipt_a4_landscape_v1&mode=preprinted_overlay", "maxBytes": 10485760, "contentType": "application/pdf"}, "metadata": {"reprint": true, "renderMode": "preprinted_overlay", "requestedAt": "2026-07-27T07:08:01.316Z", "invoiceNumber": "AJ-TOKO-BG-20260723-D2B23D66", "requestSource": "admin.sales.detail"}, "documentId": "902fd7b7-e2c9-4acb-8b4b-caa515a84592", "documentType": "receipt_certificate", "schemaVersion": 1, "printProfileId": "epson_l3251_a4_v1", "documentProfileId": "receipt_a4_landscape_v1"}	22da68121a22e05c8dd8473593413beacdd365294d7032f56d6d87bf484ffb2c	{"dryRun": false, "jobType": "print_receipt_certificate", "deviceType": "document_printer", "payloadHash": "22da68121a22e05c8dd8473593413beacdd365294d7032f56d6d87bf484ffb2c", "submittedAt": "2026-07-27T07:08:07.951Z", "agentVersion": "2.4.0-pr10-outlet-readiness", "acknowledgedAt": "2026-07-27T07:08:09.307Z"}	\N	\N	\N	receipt:902fd7b7-e2c9-4acb-8b4b-caa515a84592:reprint:ecc21216-6af8-422f-89f7-541ddae7e071	sale	902fd7b7-e2c9-4acb-8b4b-caa515a84592	2026-07-27 07:08:01.316+00	2026-07-27 15:08:01.316+00	2026-07-27 07:08:01.548+00	2026-07-27 07:08:07.726+00	2026-07-27 07:08:04.944+00	2026-07-27 07:08:09.085+00	2026-07-27 07:08:10.452+00	\N	\N	\N	\N	2026-07-27 07:08:01.316+00	2026-07-27 07:08:10.452+00
aaf1e683-1141-447f-9b2b-c1ecdfd529e2	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	\N	840c182b-642d-438d-b6ee-24f1e56833a3	2	test_label_printer	label_printer	print_label_sato	label_printer	claimed	20	1	1	{"copies": 1, "fields": {"sku": "AJ-TEST-LABEL", "size": "12", "color": "Kuning", "barcode": "AJTEST123456", "gemstone": "Zircon", "weightGram": "2.350", "productName": "CINCIN EMAS TEST ASIHJAYA", "purityPercent": "75", "sellingAmount": "1850000", "exchangePurityPercent": "70"}, "itemId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "templateId": "jewelry_compact_v1", "schemaVersion": 1, "templateVersion": 1, "printerProfileId": "sato_cg408tt_jewelry_v1"}	eded3ede48625ae189d217979121d1bd6407dcbe428839698a12f74629b9186d	{}	\N	\N	\N	hardware-test:c6799b50-7084-4d01-8847-537477fb9fff	hardware_test	c6799b50-7084-4d01-8847-537477fb9fff	2026-07-27 08:46:42.346+00	2026-07-27 08:48:42.346+00	2026-07-27 08:46:42.359+00	\N	\N	\N	\N	\N	\N	\N	\N	2026-07-27 08:46:42.346+00	2026-07-27 08:46:42.359+00
5ac1e68a-d200-40e9-94d1-ee09fd2324fb	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	\N	cf7eac61-cb18-4756-b133-2a5c60e4c56d	840c182b-642d-438d-b6ee-24f1e56833a3	2	print_receipt_certificate	document_printer	print_document_pdf	document_printer	completed	25	1	2	{"copies": 1, "download": {"path": "/api/sales/baf96a0f-bf66-4fb2-8381-02a0b3e6f33d/receipt-certificate?profile=receipt_a4_landscape_v1&mode=preprinted_overlay", "maxBytes": 10485760, "contentType": "application/pdf"}, "metadata": {"reprint": true, "renderMode": "preprinted_overlay", "requestedAt": "2026-07-27T08:43:05.882Z", "invoiceNumber": "AJ-TOKO-BG-20260723-3219EA91", "requestSource": "admin.sales.detail"}, "documentId": "baf96a0f-bf66-4fb2-8381-02a0b3e6f33d", "documentType": "receipt_certificate", "schemaVersion": 1, "printProfileId": "epson_l3251_a4_v1", "documentProfileId": "receipt_a4_landscape_v1"}	360de122226a2ff783861464469739a320fc969342768075a155d8638e41606d	{"dryRun": false, "jobType": "print_receipt_certificate", "deviceType": "document_printer", "payloadHash": "360de122226a2ff783861464469739a320fc969342768075a155d8638e41606d", "submittedAt": "2026-07-27T08:43:13.014Z", "agentVersion": "2.5.0-request-signing", "acknowledgedAt": "2026-07-27T08:43:14.359Z"}	\N	\N	\N	receipt:baf96a0f-bf66-4fb2-8381-02a0b3e6f33d:reprint:a38439ee-b21f-496e-ae62-80ab7a8428c9	sale	baf96a0f-bf66-4fb2-8381-02a0b3e6f33d	2026-07-27 08:43:05.882+00	2026-07-27 16:43:05.882+00	2026-07-27 08:43:06.051+00	2026-07-27 08:43:12.991+00	2026-07-27 08:43:09.285+00	2026-07-27 08:43:14.338+00	2026-07-27 08:43:15.473+00	\N	\N	\N	\N	2026-07-27 08:43:05.882+00	2026-07-27 08:43:15.473+00
2026074a-7218-4b58-88e1-a812455e58d8	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	85bbf9bc-b3d5-4c4d-8fc6-24d14ec450c9	840c182b-642d-438d-b6ee-24f1e56833a3	2	test_label_printer	label_printer	print_label_sato	label_printer	completed	20	1	1	{"copies": 1, "fields": {"sku": "AJ-TEST-LABEL", "size": "12", "color": "Kuning", "barcode": "AJTEST123456", "gemstone": "Zircon", "weightGram": "2.350", "productName": "CINCIN EMAS TEST ASIHJAYA", "purityPercent": "75", "sellingAmount": "1850000", "exchangePurityPercent": "70"}, "itemId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "templateId": "jewelry_compact_v1", "schemaVersion": 1, "templateVersion": 1, "printerProfileId": "sato_cg408tt_jewelry_v1"}	eded3ede48625ae189d217979121d1bd6407dcbe428839698a12f74629b9186d	{"dryRun": false, "jobType": "test_label_printer", "deviceType": "label_printer", "payloadHash": "eded3ede48625ae189d217979121d1bd6407dcbe428839698a12f74629b9186d", "submittedAt": "2026-07-27T08:47:12.658Z", "agentVersion": "2.5.0-request-signing", "acknowledgedAt": "2026-07-27T08:47:13.825Z"}	\N	\N	\N	hardware-test:78d974cc-3152-48a9-8442-933acb7e0305	hardware_test	78d974cc-3152-48a9-8442-933acb7e0305	2026-07-27 08:47:08.272+00	2026-07-27 08:49:08.272+00	2026-07-27 08:47:08.35+00	2026-07-27 08:47:12.639+00	2026-07-27 08:47:11.48+00	2026-07-27 08:47:13.805+00	2026-07-27 08:47:15.003+00	\N	\N	\N	\N	2026-07-27 08:47:08.272+00	2026-07-27 08:47:15.003+00
ff134bb9-f9c3-4113-8eb2-b65bd4c3588f	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	aacd71ca-b243-4a2c-a5be-63f48f1a7d42	840c182b-642d-438d-b6ee-24f1e56833a3	2	test_document_printer	document_printer	print_document_pdf	document_printer	completed	20	1	1	{"copies": 1, "download": {"path": "/api/sales/receipt-certificate-preview?profile=receipt_a4_landscape_v1", "maxBytes": 10485760, "contentType": "application/pdf"}, "metadata": {"reprint": false, "requestedAt": "2026-07-27T08:47:44.773Z", "requestSource": "admin.hardware_test"}, "documentId": "561378c4-6bcf-4dbe-9023-80ebd00e9bdc", "documentType": "hardware_test_document", "schemaVersion": 1, "printProfileId": "epson_l3251_a4_v1", "documentProfileId": "receipt_a4_landscape_v1"}	e19e025b64b2df516ec437b472fa5e2cc71e575cab6b6a35abdd450fcff7cad1	{"dryRun": false, "jobType": "test_document_printer", "deviceType": "document_printer", "payloadHash": "e19e025b64b2df516ec437b472fa5e2cc71e575cab6b6a35abdd450fcff7cad1", "submittedAt": "2026-07-27T08:47:53.370Z", "agentVersion": "2.5.0-request-signing", "acknowledgedAt": "2026-07-27T08:47:54.534Z"}	\N	\N	\N	hardware-test:4ec20130-c696-4b37-8e45-dbb7ed5a3050	hardware_test	4ec20130-c696-4b37-8e45-dbb7ed5a3050	2026-07-27 08:47:44.773+00	2026-07-27 08:49:44.773+00	2026-07-27 08:47:45.904+00	2026-07-27 08:47:53.348+00	2026-07-27 08:47:48.437+00	2026-07-27 08:47:54.515+00	2026-07-27 08:47:55.616+00	\N	\N	\N	\N	2026-07-27 08:47:44.773+00	2026-07-27 08:47:55.616+00
\.


--
-- Data for Name: inventory_movements; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.inventory_movements (id, organization_id, item_id, movement_type, from_outlet_id, to_outlet_id, reference_type, reference_id, reason, metadata, performed_by, approved_by, occurred_at, created_at) FROM stdin;
4e87c263-3313-4a6c-bd67-49c1bc7edd42	3f964ae0-a43e-420b-95db-d5350d8ce754	55106de5-7d80-49ef-924b-602241c445e3	goods_receipt	\N	6eabe9d2-5b95-46c6-802b-f229e895bc9a	product_item	55106de5-7d80-49ef-924b-602241c445e3	Penerimaan awal item fisik	{"sku": "AJ-ITEM-00000001", "barcode": "AJ00000001", "productId": "2fcd87b7-2654-4a9f-a1f7-1f187c34bac7", "productCode": "RING-AURELIA", "availability": "available"}	840c182b-642d-438d-b6ee-24f1e56833a3	\N	2026-07-22 18:50:41.881296+00	2026-07-22 18:50:41.881296+00
b5ad350f-9321-4614-b1dc-70f503da4e1b	3f964ae0-a43e-420b-95db-d5350d8ce754	2aab6804-23c0-435b-8b4d-495700a86365	goods_receipt	\N	6eabe9d2-5b95-46c6-802b-f229e895bc9a	product_item	2aab6804-23c0-435b-8b4d-495700a86365	Penerimaan awal item fisik	{"sku": "AJ-ITEM-00000002", "barcode": "AJ00000002", "productId": "2fcd87b7-2654-4a9f-a1f7-1f187c34bac7", "productCode": "RING-AURELIA", "availability": "available"}	840c182b-642d-438d-b6ee-24f1e56833a3	\N	2026-07-22 18:52:41.649001+00	2026-07-22 18:52:41.649001+00
52079396-e14e-4065-867d-57ebea8e43ed	3f964ae0-a43e-420b-95db-d5350d8ce754	4a633615-c71d-4221-a6e9-43f31a87c433	goods_receipt	\N	6eabe9d2-5b95-46c6-802b-f229e895bc9a	product_item	4a633615-c71d-4221-a6e9-43f31a87c433	Penerimaan awal item fisik	{"sku": "AJ-ITEM-00000003", "barcode": "AJ00000003", "productId": "0bdd002c-78a4-41fe-944c-97fe439a7fa6", "productCode": "WEDDING-BRACELET", "availability": "available"}	840c182b-642d-438d-b6ee-24f1e56833a3	\N	2026-07-22 18:55:15.348528+00	2026-07-22 18:55:15.348528+00
41e80fd4-6ec6-4c45-bb54-396490bd821c	3f964ae0-a43e-420b-95db-d5350d8ce754	3d288805-cfce-40cb-baa7-83ec95d48219	goods_receipt	\N	6eabe9d2-5b95-46c6-802b-f229e895bc9a	product_item	3d288805-cfce-40cb-baa7-83ec95d48219	Penerimaan awal item fisik	{"sku": "AJ-ITEM-00000004", "barcode": "AJ00000004", "productId": "0bdd002c-78a4-41fe-944c-97fe439a7fa6", "productCode": "WEDDING-BRACELET", "availability": "available"}	840c182b-642d-438d-b6ee-24f1e56833a3	\N	2026-07-22 18:57:24.720048+00	2026-07-22 18:57:24.720048+00
9b57aff9-9a72-49ef-b8c3-67330119e58e	3f964ae0-a43e-420b-95db-d5350d8ce754	4a633615-c71d-4221-a6e9-43f31a87c433	sale	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	sale	b811bd6a-1e1a-4b1f-b3d3-738564db1116	Terjual melalui POS AJ-TOKO-BG-20260723-8D52349C.	{"shiftId": "12a39630-334f-4567-a906-55daa8829c94", "cashierId": "1e2b1d29-e48c-43a6-b7ab-8fa0761f2524", "registerId": "066908eb-8d08-4676-a136-197b9af1a7fc", "invoiceNumber": "AJ-TOKO-BG-20260723-8D52349C", "sellingAmount": "1287000"}	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	\N	2026-07-22 19:01:12.762+00	2026-07-22 19:01:12.762+00
42d67f72-d131-48f0-bd7a-44ad7cb00033	3f964ae0-a43e-420b-95db-d5350d8ce754	2aab6804-23c0-435b-8b4d-495700a86365	sale	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	sale	a05177cf-aa7d-4258-8526-fb36c838dc50	Terjual melalui POS AJ-TOKO-BG-20260723-755DB604.	{"shiftId": "3d4da573-4f97-4d7d-818d-69d53de29e24", "cashierId": "840c182b-642d-438d-b6ee-24f1e56833a3", "registerId": "36961177-52d1-45e7-ba0c-d1bf785ce2da", "invoiceNumber": "AJ-TOKO-BG-20260723-755DB604", "sellingAmount": "1812500"}	840c182b-642d-438d-b6ee-24f1e56833a3	\N	2026-07-22 23:17:50.666+00	2026-07-22 23:17:50.666+00
5dc2d3d9-b2d3-40f8-a17c-f298127d6c4c	3f964ae0-a43e-420b-95db-d5350d8ce754	3d288805-cfce-40cb-baa7-83ec95d48219	sale	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	sale	baf96a0f-bf66-4fb2-8381-02a0b3e6f33d	Terjual melalui POS AJ-TOKO-BG-20260723-3219EA91.	{"shiftId": "58c24186-e578-4f6b-91d4-5ebbc3bf0b64", "cashierId": "840c182b-642d-438d-b6ee-24f1e56833a3", "registerId": "36961177-52d1-45e7-ba0c-d1bf785ce2da", "invoiceNumber": "AJ-TOKO-BG-20260723-3219EA91", "sellingAmount": "2062500"}	840c182b-642d-438d-b6ee-24f1e56833a3	\N	2026-07-23 08:11:56.008+00	2026-07-23 08:11:56.008+00
9f932bfc-9682-4832-a2a2-a568fe885af0	3f964ae0-a43e-420b-95db-d5350d8ce754	55106de5-7d80-49ef-924b-602241c445e3	sale	6eabe9d2-5b95-46c6-802b-f229e895bc9a	\N	sale	902fd7b7-e2c9-4acb-8b4b-caa515a84592	Terjual melalui POS AJ-TOKO-BG-20260723-D2B23D66.	{"shiftId": "58c24186-e578-4f6b-91d4-5ebbc3bf0b64", "cashierId": "840c182b-642d-438d-b6ee-24f1e56833a3", "registerId": "36961177-52d1-45e7-ba0c-d1bf785ce2da", "invoiceNumber": "AJ-TOKO-BG-20260723-D2B23D66", "sellingAmount": "1450000"}	840c182b-642d-438d-b6ee-24f1e56833a3	\N	2026-07-23 08:13:19.384+00	2026-07-23 08:13:19.384+00
37f1bd33-8639-4cc8-99ad-79f869b1f9dc	3f964ae0-a43e-420b-95db-d5350d8ce754	8f21c222-d2fa-4fb8-ad5b-a5467269af00	goods_receipt	\N	6eabe9d2-5b95-46c6-802b-f229e895bc9a	product_item	8f21c222-d2fa-4fb8-ad5b-a5467269af00	Penerimaan awal item fisik	{"sku": "AJ-ITEM-00000005", "barcode": "AJ00000005", "productId": "0bdd002c-78a4-41fe-944c-97fe439a7fa6", "productCode": "WEDDING-BRACELET", "availability": "available"}	840c182b-642d-438d-b6ee-24f1e56833a3	\N	2026-07-23 08:19:15.561021+00	2026-07-23 08:19:15.561021+00
\.


--
-- Data for Name: manual_payment_policies; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.manual_payment_policies (id, organization_id, method, co_verification_threshold, evidence_threshold, duplicate_lookback_days, is_enabled, created_at, updated_at) FROM stdin;
0a94d4df-1a69-4d55-b450-9df6dba85e52	3f964ae0-a43e-420b-95db-d5350d8ce754	debit_card	30000000	20000000	7	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
d9b7ddc8-ac34-4186-8b7e-e752fb6dcff0	3f964ae0-a43e-420b-95db-d5350d8ce754	credit_card	30000000	20000000	7	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
\.


--
-- Data for Name: manual_payment_profiles; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.manual_payment_profiles (id, organization_id, outlet_id, register_id, profile_type, code, name, provider, verification_source, merchant_id, terminal_id, destination_account, display_order, is_active, created_at, updated_at) FROM stdin;
606994dc-4d58-45c3-a8f0-ca6df3020da3	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	edc	EDC-BCA	EDC BCA	BCA	edc_terminal	\N	TID-BCA-POS-BG1	\N	10	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
ddde9ce4-6110-45d0-afc1-339d002a6d72	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	edc	EDC-BRI	EDC BRI	BRI	edc_terminal	\N	TID-BRI-POS-BG1	\N	20	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
0a62247b-70c7-4cc5-adb3-ffa4e7c3baf3	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	edc	EDC-BNI	EDC BNI	BNI	edc_terminal	\N	TID-BNI-POS-BG1	\N	30	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
f3ea08fc-5e1a-41fb-913c-8fe4e072d2ed	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	edc	EDC-MANDIRI	EDC MANDIRI	MANDIRI	edc_terminal	\N	TID-MANDIRI-POS-BG1	\N	40	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
\.


--
-- Data for Name: metal_price_rates; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.metal_price_rates (id, metal_purity_id, rate_per_gram, effective_from, effective_until, notes, created_by_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: metal_purities; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.metal_purities (id, metal_id, code, display_name, purity_percentage, is_active, created_at, updated_at) FROM stdin;
478ec62f-e6d6-4a2f-b6e9-ae04fad989eb	d9168157-9a51-4b20-902d-89ee96e0df5f	24K	24K	99.9000	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
f8f49829-7947-45b4-a354-06cd4f7d9617	d9168157-9a51-4b20-902d-89ee96e0df5f	18K	18K	75.0000	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
71b2ccc7-11b0-4320-913b-a3a42aa5e1cb	d9168157-9a51-4b20-902d-89ee96e0df5f	17K	17K	70.8333	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
e66cc641-1fa8-42e5-a0e3-ad679db384ad	d9168157-9a51-4b20-902d-89ee96e0df5f	14K	14K	58.5000	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
260b301b-16a0-4b6e-ab81-4de18eeb0c7f	6ed934a0-c9c6-4102-8edc-c43962ca1b65	925	925	92.5000	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
efb4f36c-05b1-4364-8c22-a683956f4181	b66f1efc-00d7-4715-81e8-2aba2eb3649a	950	950	95.0000	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
d4060d19-0a43-4173-99d0-75816055328d	c056d558-5b87-4f89-bffd-5d88d87f93de	950	950	95.0000	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
\.


--
-- Data for Name: metals; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.metals (id, organization_id, code, name, is_active, created_at, updated_at) FROM stdin;
d9168157-9a51-4b20-902d-89ee96e0df5f	3f964ae0-a43e-420b-95db-d5350d8ce754	GOLD	Emas	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
6ed934a0-c9c6-4102-8edc-c43962ca1b65	3f964ae0-a43e-420b-95db-d5350d8ce754	SILVER	Perak	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
b66f1efc-00d7-4715-81e8-2aba2eb3649a	3f964ae0-a43e-420b-95db-d5350d8ce754	PLATINUM	Platinum	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
c056d558-5b87-4f89-bffd-5d88d87f93de	3f964ae0-a43e-420b-95db-d5350d8ce754	PALLADIUM	Palladium	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
\.


--
-- Data for Name: notification_events; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.notification_events (id, organization_id, outlet_id, category, event_type, severity, title, summary, entity_type, entity_id, action_url, requires_action, payload, deduplication_key, occurred_at, resolved_at, created_at, updated_at) FROM stdin;
5fcc7b84-f31c-42e9-add8-7dda2bb7c43e	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_offline	warning	Hardware Hub offline	Kasir Bantar Gebang 1 di Bantar Gebang tidak merespons (terakhir heartbeat 23 Jul, 01.44). Cek mini PC, koneksi, dan printer outlet.	hardware_agent	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	t	{"reason": "reported_offline", "agentName": "Kasir Bantar Gebang 1", "lastSeenAt": "2026-07-22T18:44:08.522Z", "outletName": "Bantar Gebang"}	hardware.agent_offline:561378c4-6bcf-4dbe-9023-80ebd00e9bdc	2026-07-22 18:44:10.322+00	2026-07-22 18:47:10.077+00	2026-07-22 18:44:10.327+00	2026-07-22 18:47:10.077+00
762d077a-fdb1-4bc8-9387-2b3773c9cd91	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_recovered	success	Hardware Hub online kembali	Kasir Bantar Gebang 1 di Bantar Gebang sudah kembali online dan siap memproses job hardware.	hardware_agent_recovered	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	f	{"agentName": "Kasir Bantar Gebang 1", "outletName": "Bantar Gebang", "recoveredAt": "2026-07-22T18:47:10.084Z"}	hardware.agent_recovered:561378c4-6bcf-4dbe-9023-80ebd00e9bdc:1784746030084	2026-07-22 18:47:10.086+00	\N	2026-07-22 18:47:10.094+00	2026-07-22 18:47:10.094+00
1f9d6bdd-23e2-4733-b105-b700c2608f0f	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	sales	sale.completed	info	Transaksi berhasil	AJ-TOKO-BG-20260723-8D52349C · Rp1.287.000 · Anindita Silva	sale	b811bd6a-1e1a-4b1f-b3d3-738564db1116	/admin/penjualan/b811bd6a-1e1a-4b1f-b3d3-738564db1116	f	{"saleId": "b811bd6a-1e1a-4b1f-b3d3-738564db1116", "source": "pos.checkout", "shiftId": "12a39630-334f-4567-a906-55daa8829c94", "outletId": "6eabe9d2-5b95-46c6-802b-f229e895bc9a", "payments": [{"amount": "1287000", "method": "cash", "provider": null, "methodLabel": "Cash"}], "cashierId": "1e2b1d29-e48c-43a6-b7ab-8fa0761f2524", "itemCount": 1, "outletCode": "TOKO-BG", "outletName": "Bantar Gebang", "registerId": "066908eb-8d08-4676-a136-197b9af1a7fc", "cashierName": "Anindita Silva", "isHighValue": false, "totalAmount": "1287000", "registerCode": "POS-02", "invoiceNumber": "AJ-TOKO-BG-20260723-8D52349C", "discountAmount": "0", "isSplitPayment": false, "subtotalAmount": "1287000", "totalWeightGram": 1.65, "highValueThreshold": "30000000"}	sale.completed:b811bd6a-1e1a-4b1f-b3d3-738564db1116	2026-07-22 19:01:12.762+00	\N	2026-07-22 19:01:12.821+00	2026-07-22 19:01:12.821+00
7e3df261-0580-4ea4-806d-c1e3db1355ca	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_offline	warning	Hardware Hub offline	Kasir Bantar Gebang 1 di Bantar Gebang tidak merespons (terakhir heartbeat 23 Jul, 02.07). Cek mini PC, koneksi, dan printer outlet.	hardware_agent	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	t	{"reason": "reported_offline", "agentName": "Kasir Bantar Gebang 1", "lastSeenAt": "2026-07-22T19:07:19.453Z", "outletName": "Bantar Gebang"}	hardware.agent_offline:561378c4-6bcf-4dbe-9023-80ebd00e9bdc	2026-07-22 19:07:20.828+00	2026-07-22 19:07:27.063+00	2026-07-22 19:07:20.834+00	2026-07-22 19:07:27.063+00
a40d1525-446f-4947-bb98-19d18d629627	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_recovered	success	Hardware Hub online kembali	Kasir Bantar Gebang 1 di Bantar Gebang sudah kembali online dan siap memproses job hardware.	hardware_agent_recovered	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	f	{"agentName": "Kasir Bantar Gebang 1", "outletName": "Bantar Gebang", "recoveredAt": "2026-07-22T19:07:27.070Z"}	hardware.agent_recovered:561378c4-6bcf-4dbe-9023-80ebd00e9bdc:1784747247070	2026-07-22 19:07:27.071+00	\N	2026-07-22 19:07:27.076+00	2026-07-22 19:07:27.076+00
7c849a28-8f5a-4fed-bdbc-ee34d3925e93	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_offline	warning	Hardware Hub offline	Kasir Bantar Gebang 1 di Bantar Gebang tidak merespons (terakhir heartbeat 23 Jul, 02.09). Cek mini PC, koneksi, dan printer outlet.	hardware_agent	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	t	{"reason": "reported_offline", "agentName": "Kasir Bantar Gebang 1", "lastSeenAt": "2026-07-22T19:09:48.505Z", "outletName": "Bantar Gebang"}	hardware.agent_offline:561378c4-6bcf-4dbe-9023-80ebd00e9bdc	2026-07-22 19:09:48.867+00	2026-07-22 19:10:33.785+00	2026-07-22 19:09:48.872+00	2026-07-22 19:10:33.785+00
b6835735-b5ed-40d2-9e8f-0f513d9afbd1	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_recovered	success	Hardware Hub online kembali	Kasir Bantar Gebang 1 di Bantar Gebang sudah kembali online dan siap memproses job hardware.	hardware_agent_recovered	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	f	{"agentName": "Kasir Bantar Gebang 1", "outletName": "Bantar Gebang", "recoveredAt": "2026-07-22T19:10:33.789Z"}	hardware.agent_recovered:561378c4-6bcf-4dbe-9023-80ebd00e9bdc:1784747433789	2026-07-22 19:10:33.79+00	\N	2026-07-22 19:10:33.796+00	2026-07-22 19:10:33.796+00
b3c78cc7-1fb8-40c7-be76-03ecddd257d1	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_offline	warning	Hardware Hub offline	Kasir Bantar Gebang 1 di Bantar Gebang tidak merespons (terakhir heartbeat 23 Jul, 02.19). Cek mini PC, koneksi, dan printer outlet.	hardware_agent	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	t	{"reason": "reported_offline", "agentName": "Kasir Bantar Gebang 1", "lastSeenAt": "2026-07-22T19:19:56.859Z", "outletName": "Bantar Gebang"}	hardware.agent_offline:561378c4-6bcf-4dbe-9023-80ebd00e9bdc	2026-07-22 19:19:57.536+00	2026-07-22 22:51:59.57+00	2026-07-22 19:19:57.541+00	2026-07-22 22:51:59.57+00
6e490f62-15c4-43e3-852c-052202371108	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_recovered	success	Hardware Hub online kembali	Kasir Bantar Gebang 1 di Bantar Gebang sudah kembali online dan siap memproses job hardware.	hardware_agent_recovered	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	f	{"agentName": "Kasir Bantar Gebang 1", "outletName": "Bantar Gebang", "recoveredAt": "2026-07-22T22:51:59.579Z"}	hardware.agent_recovered:561378c4-6bcf-4dbe-9023-80ebd00e9bdc:1784760719579	2026-07-22 22:51:59.582+00	\N	2026-07-22 22:51:59.592+00	2026-07-22 22:51:59.592+00
9323527c-8a5d-4372-93ee-35d8bce93330	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_offline	critical	Hardware Hub offline	Kasir Bantar Gebang 1 di Bantar Gebang tidak merespons (terakhir heartbeat 23 Jul, 06.30). Cek mini PC, koneksi, dan printer outlet.	hardware_agent	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	t	{"reason": "stale_heartbeat", "agentName": "Kasir Bantar Gebang 1", "lastSeenAt": "2026-07-22T23:30:01.862Z", "outletName": "Bantar Gebang"}	hardware.agent_offline:561378c4-6bcf-4dbe-9023-80ebd00e9bdc	2026-07-22 23:35:31.582+00	2026-07-23 07:33:22.112+00	2026-07-22 23:35:31.733+00	2026-07-23 07:33:22.112+00
9d756494-bd20-427d-aca3-df5e32af7b50	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_recovered	success	Hardware Hub online kembali	Kasir Bantar Gebang 1 di Bantar Gebang sudah kembali online dan siap memproses job hardware.	hardware_agent_recovered	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	f	{"agentName": "Kasir Bantar Gebang 1", "outletName": "Bantar Gebang", "recoveredAt": "2026-07-23T07:33:22.194Z"}	hardware.agent_recovered:561378c4-6bcf-4dbe-9023-80ebd00e9bdc:1784792002194	2026-07-23 07:33:22.197+00	\N	2026-07-23 07:33:22.213+00	2026-07-23 07:33:22.213+00
996eb896-df78-4af7-874e-94d6bf191edf	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_offline	warning	Hardware Hub offline	Kasir Bantar Gebang 1 di Bantar Gebang tidak merespons (terakhir heartbeat 23 Jul, 14.40). Cek mini PC, koneksi, dan printer outlet.	hardware_agent	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	t	{"reason": "reported_offline", "agentName": "Kasir Bantar Gebang 1", "lastSeenAt": "2026-07-23T07:40:43.314Z", "outletName": "Bantar Gebang"}	hardware.agent_offline:561378c4-6bcf-4dbe-9023-80ebd00e9bdc	2026-07-23 07:40:43.752+00	2026-07-23 08:51:19.926+00	2026-07-23 07:40:43.757+00	2026-07-23 08:51:19.926+00
3f0b0e92-5088-46d1-9878-960ca82c833c	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_recovered	success	Hardware Hub online kembali	Kasir Bantar Gebang 1 di Bantar Gebang sudah kembali online dan siap memproses job hardware.	hardware_agent_recovered	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	f	{"agentName": "Kasir Bantar Gebang 1", "outletName": "Bantar Gebang", "recoveredAt": "2026-07-23T08:51:19.935Z"}	hardware.agent_recovered:561378c4-6bcf-4dbe-9023-80ebd00e9bdc:1784796679935	2026-07-23 08:51:19.937+00	\N	2026-07-23 08:51:19.946+00	2026-07-23 08:51:19.946+00
f964d73b-026c-404e-98f2-dc38f4ca0d98	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_offline	warning	Hardware Hub offline	Kasir Bantar Gebang 1 di Bantar Gebang tidak merespons (terakhir heartbeat 24 Jul, 01.21). Cek mini PC, koneksi, dan printer outlet.	hardware_agent	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	t	{"reason": "reported_offline", "agentName": "Kasir Bantar Gebang 1", "lastSeenAt": "2026-07-23T18:21:39.685Z", "outletName": "Bantar Gebang"}	hardware.agent_offline:561378c4-6bcf-4dbe-9023-80ebd00e9bdc	2026-07-23 18:21:41.31+00	2026-07-23 18:29:41.151+00	2026-07-23 18:21:41.316+00	2026-07-23 18:29:41.151+00
9b3dc1fc-79eb-495d-99b8-31c5270c1dbd	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_recovered	success	Hardware Hub online kembali	Kasir Bantar Gebang 1 di Bantar Gebang sudah kembali online dan siap memproses job hardware.	hardware_agent_recovered	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	f	{"agentName": "Kasir Bantar Gebang 1", "outletName": "Bantar Gebang", "recoveredAt": "2026-07-23T18:29:41.160Z"}	hardware.agent_recovered:561378c4-6bcf-4dbe-9023-80ebd00e9bdc:1784831381160	2026-07-23 18:29:41.162+00	\N	2026-07-23 18:29:41.171+00	2026-07-23 18:29:41.171+00
8eafc2f8-db2b-4640-a088-b7bf6ca01426	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	approval_result	approval.rejected	warning	Penarikan Dana Titip ditolak	Penarikan Dana Titip telah ditolak. Catatan: Maaf tidak bisa tarik dana titipan untuk saat ini	approval	95f9bede-076c-4e2e-99a3-0c64af51849a	/admin/operasional/approval	f	{"status": "rejected", "approvalId": "95f9bede-076c-4e2e-99a3-0c64af51849a", "referenceId": "da5c8f1c-9d23-4085-ad57-f2d1cbed9fec", "approvalType": "customer_deposit_withdrawal", "resolvedById": "09bf466f-0533-402a-8175-f12c05fbe101", "referenceType": "customer", "requestedById": "840c182b-642d-438d-b6ee-24f1e56833a3", "responseNotes": "Maaf tidak bisa tarik dana titipan untuk saat ini", "requestSnapshot": {"reason": "Customer meminta dana titip 50ribu", "outletName": "Bantar Gebang", "customerCode": "CUST-20260723-04F7E805", "customerName": "Siti Aminah", "depositAmount": 50000, "requesterName": "System Administrator", "withdrawalAmount": 50000}, "executionRequired": false}	approval.rejected:95f9bede-076c-4e2e-99a3-0c64af51849a	2026-07-23 18:37:42.226+00	\N	2026-07-23 18:37:42.255+00	2026-07-23 18:37:42.255+00
9a6bf98f-5a30-4ee3-81c3-1bd865158b48	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_offline	warning	Hardware Hub offline	Kasir Bantar Gebang 1 di Bantar Gebang tidak merespons (terakhir heartbeat 24 Jul, 10.08). Cek mini PC, koneksi, dan printer outlet.	hardware_agent	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	t	{"reason": "reported_offline", "agentName": "Kasir Bantar Gebang 1", "lastSeenAt": "2026-07-24T03:08:09.232Z", "outletName": "Bantar Gebang"}	hardware.agent_offline:561378c4-6bcf-4dbe-9023-80ebd00e9bdc	2026-07-24 03:08:09.863+00	2026-07-25 07:03:02.406+00	2026-07-24 03:08:09.87+00	2026-07-25 07:03:02.406+00
e22d672a-bb38-405d-b9e8-0bc6b07ce2ff	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_recovered	success	Hardware Hub online kembali	Kasir Bantar Gebang 1 di Bantar Gebang sudah kembali online dan siap memproses job hardware.	hardware_agent_recovered	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	f	{"agentName": "Kasir Bantar Gebang 1", "outletName": "Bantar Gebang", "recoveredAt": "2026-07-25T07:03:02.540Z"}	hardware.agent_recovered:561378c4-6bcf-4dbe-9023-80ebd00e9bdc:1784962982540	2026-07-25 07:03:02.544+00	\N	2026-07-25 07:03:02.59+00	2026-07-25 07:03:02.59+00
6916be18-ed61-43ad-a617-3623e2d77e6b	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_offline	warning	Hardware Hub offline	Kasir Bantar Gebang 1 di Bantar Gebang tidak merespons (terakhir heartbeat 26 Jul, 06.30). Cek mini PC, koneksi, dan printer outlet.	hardware_agent	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	t	{"reason": "reported_offline", "agentName": "Kasir Bantar Gebang 1", "lastSeenAt": "2026-07-25T23:30:56.289Z", "outletName": "Bantar Gebang"}	hardware.agent_offline:561378c4-6bcf-4dbe-9023-80ebd00e9bdc	2026-07-25 23:30:57.392+00	2026-07-26 08:27:58.02+00	2026-07-25 23:30:57.399+00	2026-07-26 08:27:58.02+00
744bb002-727d-41ce-8b93-6e15ac2eeac3	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_recovered	success	Hardware Hub online kembali	Kasir Bantar Gebang 1 di Bantar Gebang sudah kembali online dan siap memproses job hardware.	hardware_agent_recovered	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	f	{"agentName": "Kasir Bantar Gebang 1", "outletName": "Bantar Gebang", "recoveredAt": "2026-07-26T08:27:58.040Z"}	hardware.agent_recovered:561378c4-6bcf-4dbe-9023-80ebd00e9bdc:1785054478040	2026-07-26 08:27:58.042+00	\N	2026-07-26 08:27:58.067+00	2026-07-26 08:27:58.067+00
a2f7494d-37e2-4534-9c51-177995c4f0fa	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_offline	critical	Hardware Hub offline	Kasir Bantar Gebang 1 di Bantar Gebang tidak merespons (terakhir heartbeat 26 Jul, 17.07). Cek mini PC, koneksi, dan printer outlet.	hardware_agent	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	t	{"reason": "stale_heartbeat", "agentName": "Kasir Bantar Gebang 1", "lastSeenAt": "2026-07-26T10:07:54.056Z", "outletName": "Bantar Gebang"}	hardware.agent_offline:561378c4-6bcf-4dbe-9023-80ebd00e9bdc	2026-07-26 11:06:37.715+00	2026-07-27 06:17:25.1+00	2026-07-26 11:06:38.213+00	2026-07-27 06:17:25.1+00
71743af7-97c5-40de-9b63-f488e97eb74d	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_recovered	success	Hardware Hub online kembali	Kasir Bantar Gebang 1 di Bantar Gebang sudah kembali online dan siap memproses job hardware.	hardware_agent_recovered	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	f	{"agentName": "Kasir Bantar Gebang 1", "outletName": "Bantar Gebang", "recoveredAt": "2026-07-27T06:17:25.143Z"}	hardware.agent_recovered:561378c4-6bcf-4dbe-9023-80ebd00e9bdc:1785133045143	2026-07-27 06:17:25.148+00	\N	2026-07-27 06:17:25.167+00	2026-07-27 06:17:25.167+00
0ae8552d-9a18-47f7-a550-0300896b044e	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_offline	warning	Hardware Hub offline	Kasir Bantar Gebang 1 di Bantar Gebang tidak merespons (terakhir heartbeat 27 Jul, 13.54). Cek mini PC, koneksi, dan printer outlet.	hardware_agent	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	t	{"reason": "reported_offline", "agentName": "Kasir Bantar Gebang 1", "lastSeenAt": "2026-07-27T06:54:19.438Z", "outletName": "Bantar Gebang"}	hardware.agent_offline:561378c4-6bcf-4dbe-9023-80ebd00e9bdc	2026-07-27 06:54:20.94+00	2026-07-27 07:06:32.304+00	2026-07-27 06:54:20.946+00	2026-07-27 07:06:32.304+00
32e2fa0a-9215-4c46-afc8-042e905917ac	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_recovered	success	Hardware Hub online kembali	Kasir Bantar Gebang 1 di Bantar Gebang sudah kembali online dan siap memproses job hardware.	hardware_agent_recovered	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	f	{"agentName": "Kasir Bantar Gebang 1", "outletName": "Bantar Gebang", "recoveredAt": "2026-07-27T07:06:32.312Z"}	hardware.agent_recovered:561378c4-6bcf-4dbe-9023-80ebd00e9bdc:1785135992312	2026-07-27 07:06:32.314+00	\N	2026-07-27 07:06:32.322+00	2026-07-27 07:06:32.322+00
e67b347b-fc48-4411-96f5-2e8b50cd7a62	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_offline	warning	Hardware Hub offline	Kasir Bantar Gebang 1 di Bantar Gebang tidak merespons (terakhir heartbeat 27 Jul, 14.09). Cek mini PC, koneksi, dan printer outlet.	hardware_agent	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	t	{"reason": "reported_offline", "agentName": "Kasir Bantar Gebang 1", "lastSeenAt": "2026-07-27T07:09:09.672Z", "outletName": "Bantar Gebang"}	hardware.agent_offline:561378c4-6bcf-4dbe-9023-80ebd00e9bdc	2026-07-27 07:09:11.446+00	2026-07-27 07:09:56.696+00	2026-07-27 07:09:11.452+00	2026-07-27 07:09:56.696+00
5641e871-1fab-489d-b363-353b7fc6f55d	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_recovered	success	Hardware Hub online kembali	Kasir Bantar Gebang 1 di Bantar Gebang sudah kembali online dan siap memproses job hardware.	hardware_agent_recovered	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	f	{"agentName": "Kasir Bantar Gebang 1", "outletName": "Bantar Gebang", "recoveredAt": "2026-07-27T07:09:56.703Z"}	hardware.agent_recovered:561378c4-6bcf-4dbe-9023-80ebd00e9bdc:1785136196703	2026-07-27 07:09:56.705+00	\N	2026-07-27 07:09:56.711+00	2026-07-27 07:09:56.711+00
ec2354f7-eea2-4c79-aea9-24e7635ae557	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_offline	warning	Hardware Hub offline	Kasir Bantar Gebang 1 di Bantar Gebang tidak merespons (terakhir heartbeat 27 Jul, 14.13). Cek mini PC, koneksi, dan printer outlet.	hardware_agent	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	t	{"reason": "reported_offline", "agentName": "Kasir Bantar Gebang 1", "lastSeenAt": "2026-07-27T07:13:50.377Z", "outletName": "Bantar Gebang"}	hardware.agent_offline:561378c4-6bcf-4dbe-9023-80ebd00e9bdc	2026-07-27 07:13:51.579+00	2026-07-27 08:40:21.027+00	2026-07-27 07:13:51.586+00	2026-07-27 08:40:21.027+00
08ccc18c-90b5-4138-9f25-cdba188383fb	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_recovered	success	Hardware Hub online kembali	Kasir Bantar Gebang 1 di Bantar Gebang sudah kembali online dan siap memproses job hardware.	hardware_agent_recovered	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	f	{"agentName": "Kasir Bantar Gebang 1", "outletName": "Bantar Gebang", "recoveredAt": "2026-07-27T08:40:21.037Z"}	hardware.agent_recovered:561378c4-6bcf-4dbe-9023-80ebd00e9bdc:1785141621037	2026-07-27 08:40:21.039+00	\N	2026-07-27 08:40:21.05+00	2026-07-27 08:40:21.05+00
a1b7660a-5372-4e3c-be0b-a01140afecb5	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_offline	warning	Hardware Hub offline	Kasir Bantar Gebang 1 di Bantar Gebang tidak merespons (terakhir heartbeat 27 Jul, 15.52). Cek mini PC, koneksi, dan printer outlet.	hardware_agent	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	t	{"reason": "reported_offline", "agentName": "Kasir Bantar Gebang 1", "lastSeenAt": "2026-07-27T08:52:14.539Z", "outletName": "Bantar Gebang"}	hardware.agent_offline:561378c4-6bcf-4dbe-9023-80ebd00e9bdc	2026-07-27 08:52:15.075+00	2026-07-27 21:06:21.814+00	2026-07-27 08:52:15.085+00	2026-07-27 21:06:21.814+00
5890345a-9d8c-48ea-8220-6b816b892644	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_recovered	success	Hardware Hub online kembali	Kasir Bantar Gebang 1 di Bantar Gebang sudah kembali online dan siap memproses job hardware.	hardware_agent_recovered	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	f	{"agentName": "Kasir Bantar Gebang 1", "outletName": "Bantar Gebang", "recoveredAt": "2026-07-27T21:06:21.833Z"}	hardware.agent_recovered:561378c4-6bcf-4dbe-9023-80ebd00e9bdc:1785186381833	2026-07-27 21:06:21.835+00	\N	2026-07-27 21:06:21.855+00	2026-07-27 21:06:21.855+00
eda3b006-568d-4a05-ae2f-733768b28145	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_offline	warning	Hardware Hub offline	Kasir Bantar Gebang 1 di Bantar Gebang tidak merespons (terakhir heartbeat 28 Jul, 04.07). Cek mini PC, koneksi, dan printer outlet.	hardware_agent	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	t	{"reason": "reported_offline", "agentName": "Kasir Bantar Gebang 1", "lastSeenAt": "2026-07-27T21:07:44.712Z", "outletName": "Bantar Gebang"}	hardware.agent_offline:561378c4-6bcf-4dbe-9023-80ebd00e9bdc	2026-07-27 21:07:46.343+00	2026-07-27 21:15:21.357+00	2026-07-27 21:07:46.353+00	2026-07-27 21:15:21.357+00
d39108a1-97da-473e-9a2b-3551ffbdfb19	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_recovered	success	Hardware Hub online kembali	Kasir Bantar Gebang 1 di Bantar Gebang sudah kembali online dan siap memproses job hardware.	hardware_agent_recovered	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	f	{"agentName": "Kasir Bantar Gebang 1", "outletName": "Bantar Gebang", "recoveredAt": "2026-07-27T21:15:21.365Z"}	hardware.agent_recovered:561378c4-6bcf-4dbe-9023-80ebd00e9bdc:1785186921365	2026-07-27 21:15:21.367+00	\N	2026-07-27 21:15:21.376+00	2026-07-27 21:15:21.376+00
691f38c9-8367-405a-bf33-f7fab21ca05b	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	hardware	hardware.agent_offline	warning	Hardware Hub offline	Kasir Bantar Gebang 1 di Bantar Gebang tidak merespons (terakhir heartbeat 28 Jul, 04.37). Cek mini PC, koneksi, dan printer outlet.	hardware_agent	561378c4-6bcf-4dbe-9023-80ebd00e9bdc	/admin/operasional/hardware	t	{"reason": "reported_offline", "agentName": "Kasir Bantar Gebang 1", "lastSeenAt": "2026-07-27T21:37:09.220Z", "outletName": "Bantar Gebang"}	hardware.agent_offline:561378c4-6bcf-4dbe-9023-80ebd00e9bdc	2026-07-27 21:37:09.508+00	\N	2026-07-27 21:37:09.518+00	2026-07-27 21:37:09.518+00
\.


--
-- Data for Name: notification_recipients; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.notification_recipients (id, event_id, user_id, status, read_at, acknowledged_at, resolved_at, archived_at, created_at, updated_at) FROM stdin;
c869d882-555d-4707-8160-ef3aea57161a	5fcc7b84-f31c-42e9-add8-7dda2bb7c43e	840c182b-642d-438d-b6ee-24f1e56833a3	archived	2026-07-22 18:47:10.077+00	\N	2026-07-22 18:47:10.077+00	2026-07-23 00:10:08.478+00	2026-07-22 18:44:10.327+00	2026-07-23 00:10:08.478+00
83ea335b-1228-4475-a13f-876fd57bb337	762d077a-fdb1-4bc8-9387-2b3773c9cd91	840c182b-642d-438d-b6ee-24f1e56833a3	archived	2026-07-22 18:47:20.748+00	\N	\N	2026-07-23 00:10:08.478+00	2026-07-22 18:47:10.094+00	2026-07-23 00:10:08.478+00
336dc985-8ace-4855-9778-b612dcec11de	1f9d6bdd-23e2-4733-b105-b700c2608f0f	840c182b-642d-438d-b6ee-24f1e56833a3	archived	2026-07-22 19:03:20.913+00	\N	\N	2026-07-23 00:10:08.478+00	2026-07-22 19:01:12.821+00	2026-07-23 00:10:08.478+00
26e9ce09-0060-46ad-9248-a6844992539f	7e3df261-0580-4ea4-806d-c1e3db1355ca	840c182b-642d-438d-b6ee-24f1e56833a3	archived	2026-07-22 19:07:27.063+00	\N	2026-07-22 19:07:27.063+00	2026-07-23 00:10:08.478+00	2026-07-22 19:07:20.834+00	2026-07-23 00:10:08.478+00
84d15773-becd-469a-bd21-7c7c09211fc0	a40d1525-446f-4947-bb98-19d18d629627	840c182b-642d-438d-b6ee-24f1e56833a3	archived	2026-07-22 19:07:36.704+00	\N	\N	2026-07-23 00:10:08.478+00	2026-07-22 19:07:27.076+00	2026-07-23 00:10:08.478+00
57d67293-c3a7-4150-9540-e2e148f501ce	7c849a28-8f5a-4fed-bdbc-ee34d3925e93	840c182b-642d-438d-b6ee-24f1e56833a3	archived	2026-07-22 19:10:33.785+00	\N	2026-07-22 19:10:33.785+00	2026-07-23 00:10:08.478+00	2026-07-22 19:09:48.872+00	2026-07-23 00:10:08.478+00
f3585ca5-4123-450f-a19b-90ab942c9592	b6835735-b5ed-40d2-9e8f-0f513d9afbd1	840c182b-642d-438d-b6ee-24f1e56833a3	archived	2026-07-22 19:10:45.165+00	\N	\N	2026-07-23 00:10:08.478+00	2026-07-22 19:10:33.796+00	2026-07-23 00:10:08.478+00
772a86af-aabb-4eae-89e3-82942d42907a	b3c78cc7-1fb8-40c7-be76-03ecddd257d1	840c182b-642d-438d-b6ee-24f1e56833a3	archived	2026-07-22 22:51:59.57+00	\N	2026-07-22 22:51:59.57+00	2026-07-23 00:10:08.478+00	2026-07-22 19:19:57.541+00	2026-07-23 00:10:08.478+00
e864d417-b480-4676-ab7c-3ab37182d901	6e490f62-15c4-43e3-852c-052202371108	840c182b-642d-438d-b6ee-24f1e56833a3	archived	2026-07-22 22:52:17.948+00	\N	\N	2026-07-23 00:10:08.478+00	2026-07-22 22:51:59.592+00	2026-07-23 00:10:08.478+00
8e3ce149-537e-4bbd-b180-45e7aae016d2	9323527c-8a5d-4372-93ee-35d8bce93330	840c182b-642d-438d-b6ee-24f1e56833a3	archived	2026-07-23 00:10:01.54+00	\N	\N	2026-07-23 00:10:08.478+00	2026-07-22 23:35:31.733+00	2026-07-23 00:10:08.478+00
b9f1109a-8051-4cc7-8167-5dfb57f0b570	9d756494-bd20-427d-aca3-df5e32af7b50	840c182b-642d-438d-b6ee-24f1e56833a3	read	2026-07-23 07:33:51.769+00	\N	\N	\N	2026-07-23 07:33:22.213+00	2026-07-23 07:33:51.769+00
78db6862-4493-433f-854a-43c536786cc8	996eb896-df78-4af7-874e-94d6bf191edf	840c182b-642d-438d-b6ee-24f1e56833a3	resolved	2026-07-23 07:50:22.276+00	\N	2026-07-23 08:51:19.926+00	\N	2026-07-23 07:40:43.757+00	2026-07-23 08:51:19.926+00
597e151f-d879-4638-a836-a47238aa2f09	3f0b0e92-5088-46d1-9878-960ca82c833c	840c182b-642d-438d-b6ee-24f1e56833a3	read	2026-07-23 08:51:38.944+00	\N	\N	\N	2026-07-23 08:51:19.946+00	2026-07-23 08:51:38.944+00
72a5ce25-7993-418f-9b20-434e54be0273	f964d73b-026c-404e-98f2-dc38f4ca0d98	840c182b-642d-438d-b6ee-24f1e56833a3	resolved	2026-07-23 18:29:41.151+00	\N	2026-07-23 18:29:41.151+00	\N	2026-07-23 18:21:41.316+00	2026-07-23 18:29:41.151+00
7e968195-bf1f-47e4-9249-879ab348cb8a	9b3dc1fc-79eb-495d-99b8-31c5270c1dbd	840c182b-642d-438d-b6ee-24f1e56833a3	read	2026-07-23 18:30:43.204+00	\N	\N	\N	2026-07-23 18:29:41.171+00	2026-07-23 18:30:43.204+00
bccdaf47-0d59-44f2-b395-eaa57de14b30	8eafc2f8-db2b-4640-a088-b7bf6ca01426	840c182b-642d-438d-b6ee-24f1e56833a3	read	2026-07-23 18:38:27.684+00	\N	\N	\N	2026-07-23 18:37:42.255+00	2026-07-23 18:38:27.684+00
8d41ba2f-dcac-47c5-a645-5d30034d98e0	9a6bf98f-5a30-4ee3-81c3-1bd865158b48	09bf466f-0533-402a-8175-f12c05fbe101	resolved	2026-07-25 07:03:02.406+00	\N	2026-07-25 07:03:02.406+00	\N	2026-07-24 03:08:09.87+00	2026-07-25 07:03:02.406+00
390127e2-3de8-4360-94ea-cb082fde8660	9a6bf98f-5a30-4ee3-81c3-1bd865158b48	840c182b-642d-438d-b6ee-24f1e56833a3	resolved	2026-07-25 07:03:02.406+00	\N	2026-07-25 07:03:02.406+00	\N	2026-07-24 03:08:09.87+00	2026-07-25 07:03:02.406+00
9d1aa0ce-ddc0-4625-843c-3b35f037f5c5	e22d672a-bb38-405d-b9e8-0bc6b07ce2ff	09bf466f-0533-402a-8175-f12c05fbe101	unread	\N	\N	\N	\N	2026-07-25 07:03:02.59+00	2026-07-25 07:03:02.59+00
e88f4388-5652-4ef2-a45c-07923dcf9d8a	e22d672a-bb38-405d-b9e8-0bc6b07ce2ff	840c182b-642d-438d-b6ee-24f1e56833a3	read	2026-07-25 07:03:10.097+00	\N	\N	\N	2026-07-25 07:03:02.59+00	2026-07-25 07:03:10.097+00
ce7ce09f-e04b-4618-b5ed-be1886194d64	6916be18-ed61-43ad-a617-3623e2d77e6b	09bf466f-0533-402a-8175-f12c05fbe101	resolved	2026-07-26 08:27:58.02+00	\N	2026-07-26 08:27:58.02+00	\N	2026-07-25 23:30:57.399+00	2026-07-26 08:27:58.02+00
d098cf1b-35d6-492c-a304-775532119480	6916be18-ed61-43ad-a617-3623e2d77e6b	840c182b-642d-438d-b6ee-24f1e56833a3	resolved	2026-07-26 08:27:58.02+00	\N	2026-07-26 08:27:58.02+00	\N	2026-07-25 23:30:57.399+00	2026-07-26 08:27:58.02+00
588b480e-9fe2-43f6-84ef-3330d3b6ad05	744bb002-727d-41ce-8b93-6e15ac2eeac3	09bf466f-0533-402a-8175-f12c05fbe101	unread	\N	\N	\N	\N	2026-07-26 08:27:58.067+00	2026-07-26 08:27:58.067+00
dcfcbec5-3c28-4fb5-bf98-62247f391bc1	744bb002-727d-41ce-8b93-6e15ac2eeac3	840c182b-642d-438d-b6ee-24f1e56833a3	read	2026-07-26 08:32:05.581+00	\N	\N	\N	2026-07-26 08:27:58.067+00	2026-07-26 08:32:05.581+00
49d98fcb-5d2d-4148-822e-ced90c618dda	a2f7494d-37e2-4534-9c51-177995c4f0fa	09bf466f-0533-402a-8175-f12c05fbe101	resolved	2026-07-27 06:17:25.1+00	\N	2026-07-27 06:17:25.1+00	\N	2026-07-26 11:06:38.213+00	2026-07-27 06:17:25.1+00
b6bc917b-15c4-4948-a442-3865cc61ee52	a2f7494d-37e2-4534-9c51-177995c4f0fa	840c182b-642d-438d-b6ee-24f1e56833a3	resolved	2026-07-26 11:06:51.015+00	\N	2026-07-27 06:17:25.1+00	\N	2026-07-26 11:06:38.213+00	2026-07-27 06:17:25.1+00
e5b564c3-12a4-4128-b5ef-9ba4f5023616	71743af7-97c5-40de-9b63-f488e97eb74d	09bf466f-0533-402a-8175-f12c05fbe101	unread	\N	\N	\N	\N	2026-07-27 06:17:25.167+00	2026-07-27 06:17:25.167+00
682ede7a-e550-4943-8c9f-5e06068bc0db	71743af7-97c5-40de-9b63-f488e97eb74d	840c182b-642d-438d-b6ee-24f1e56833a3	read	2026-07-27 06:17:29.316+00	\N	\N	\N	2026-07-27 06:17:25.167+00	2026-07-27 06:17:29.316+00
035f66e1-8d8c-46c0-a8bd-2d5460be836c	0ae8552d-9a18-47f7-a550-0300896b044e	09bf466f-0533-402a-8175-f12c05fbe101	resolved	2026-07-27 07:06:32.304+00	\N	2026-07-27 07:06:32.304+00	\N	2026-07-27 06:54:20.946+00	2026-07-27 07:06:32.304+00
36db2460-421d-4e4f-96b0-65c4dbe77aa0	0ae8552d-9a18-47f7-a550-0300896b044e	840c182b-642d-438d-b6ee-24f1e56833a3	resolved	2026-07-27 07:06:32.304+00	\N	2026-07-27 07:06:32.304+00	\N	2026-07-27 06:54:20.946+00	2026-07-27 07:06:32.304+00
5f4f0516-7402-43d2-9af6-80d320815268	32e2fa0a-9215-4c46-afc8-042e905917ac	09bf466f-0533-402a-8175-f12c05fbe101	unread	\N	\N	\N	\N	2026-07-27 07:06:32.322+00	2026-07-27 07:06:32.322+00
52e38e02-728c-4aa8-b84b-50e21e5292c5	32e2fa0a-9215-4c46-afc8-042e905917ac	840c182b-642d-438d-b6ee-24f1e56833a3	read	2026-07-27 07:07:04.008+00	\N	\N	\N	2026-07-27 07:06:32.322+00	2026-07-27 07:07:04.008+00
4ae66a50-95d6-4562-8d41-b8fd7b946c53	e67b347b-fc48-4411-96f5-2e8b50cd7a62	09bf466f-0533-402a-8175-f12c05fbe101	resolved	2026-07-27 07:09:56.696+00	\N	2026-07-27 07:09:56.696+00	\N	2026-07-27 07:09:11.452+00	2026-07-27 07:09:56.696+00
04d743fe-e78c-42b1-8360-8474e457f568	e67b347b-fc48-4411-96f5-2e8b50cd7a62	840c182b-642d-438d-b6ee-24f1e56833a3	resolved	2026-07-27 07:09:56.696+00	\N	2026-07-27 07:09:56.696+00	\N	2026-07-27 07:09:11.452+00	2026-07-27 07:09:56.696+00
8904cb43-d369-4e90-84d4-1b5f53f5e60e	5641e871-1fab-489d-b363-353b7fc6f55d	09bf466f-0533-402a-8175-f12c05fbe101	unread	\N	\N	\N	\N	2026-07-27 07:09:56.711+00	2026-07-27 07:09:56.711+00
4f3d044c-1acd-4a79-8216-0ac6e76225b3	5641e871-1fab-489d-b363-353b7fc6f55d	840c182b-642d-438d-b6ee-24f1e56833a3	read	2026-07-27 07:10:55.327+00	\N	\N	\N	2026-07-27 07:09:56.711+00	2026-07-27 07:10:55.327+00
492eca12-fa69-4aec-9c55-88c7ef234658	ec2354f7-eea2-4c79-aea9-24e7635ae557	09bf466f-0533-402a-8175-f12c05fbe101	resolved	2026-07-27 08:40:21.027+00	\N	2026-07-27 08:40:21.027+00	\N	2026-07-27 07:13:51.586+00	2026-07-27 08:40:21.027+00
d4973cf1-8059-4d12-af36-063f401f2511	ec2354f7-eea2-4c79-aea9-24e7635ae557	840c182b-642d-438d-b6ee-24f1e56833a3	resolved	2026-07-27 08:40:21.027+00	\N	2026-07-27 08:40:21.027+00	\N	2026-07-27 07:13:51.586+00	2026-07-27 08:40:21.027+00
2a6c1019-9e01-4810-be72-df48b2b4976a	08ccc18c-90b5-4138-9f25-cdba188383fb	09bf466f-0533-402a-8175-f12c05fbe101	unread	\N	\N	\N	\N	2026-07-27 08:40:21.05+00	2026-07-27 08:40:21.05+00
d6b7f430-b8c8-46a1-90a1-1e88c9a94c38	08ccc18c-90b5-4138-9f25-cdba188383fb	840c182b-642d-438d-b6ee-24f1e56833a3	read	2026-07-27 08:41:38.388+00	\N	\N	\N	2026-07-27 08:40:21.05+00	2026-07-27 08:41:38.388+00
aaf535df-8e4e-410e-a208-6b720011ca1b	a1b7660a-5372-4e3c-be0b-a01140afecb5	09bf466f-0533-402a-8175-f12c05fbe101	resolved	2026-07-27 21:06:21.814+00	\N	2026-07-27 21:06:21.814+00	\N	2026-07-27 08:52:15.085+00	2026-07-27 21:06:21.814+00
66243b44-0f44-4d66-9462-8d56a0e6e964	a1b7660a-5372-4e3c-be0b-a01140afecb5	840c182b-642d-438d-b6ee-24f1e56833a3	resolved	2026-07-27 21:06:21.814+00	\N	2026-07-27 21:06:21.814+00	\N	2026-07-27 08:52:15.085+00	2026-07-27 21:06:21.814+00
5d4599ec-a887-45fb-a289-39477a0f3af7	5890345a-9d8c-48ea-8220-6b816b892644	09bf466f-0533-402a-8175-f12c05fbe101	unread	\N	\N	\N	\N	2026-07-27 21:06:21.855+00	2026-07-27 21:06:21.855+00
823c4c9e-c6ee-478b-890b-c1e5522ae021	5890345a-9d8c-48ea-8220-6b816b892644	840c182b-642d-438d-b6ee-24f1e56833a3	read	2026-07-27 21:06:59.137+00	\N	\N	\N	2026-07-27 21:06:21.855+00	2026-07-27 21:06:59.137+00
91400ef8-4afa-4f96-9061-6707a3862cdc	eda3b006-568d-4a05-ae2f-733768b28145	09bf466f-0533-402a-8175-f12c05fbe101	resolved	2026-07-27 21:15:21.357+00	\N	2026-07-27 21:15:21.357+00	\N	2026-07-27 21:07:46.353+00	2026-07-27 21:15:21.357+00
6721184c-8dc7-43fe-9e59-b840d9f3099e	eda3b006-568d-4a05-ae2f-733768b28145	840c182b-642d-438d-b6ee-24f1e56833a3	resolved	2026-07-27 21:15:21.357+00	\N	2026-07-27 21:15:21.357+00	\N	2026-07-27 21:07:46.353+00	2026-07-27 21:15:21.357+00
ea35662c-e361-4c2b-9d8c-b0238fd93c66	d39108a1-97da-473e-9a2b-3551ffbdfb19	09bf466f-0533-402a-8175-f12c05fbe101	unread	\N	\N	\N	\N	2026-07-27 21:15:21.376+00	2026-07-27 21:15:21.376+00
9415abba-bb0e-4b74-90b5-5053a7508387	d39108a1-97da-473e-9a2b-3551ffbdfb19	840c182b-642d-438d-b6ee-24f1e56833a3	read	2026-07-27 21:22:14.622+00	\N	\N	\N	2026-07-27 21:15:21.376+00	2026-07-27 21:22:14.622+00
6c5cef51-15f0-41ec-b78f-f61003265b9d	691f38c9-8367-405a-bf33-f7fab21ca05b	09bf466f-0533-402a-8175-f12c05fbe101	unread	\N	\N	\N	\N	2026-07-27 21:37:09.518+00	2026-07-27 21:37:09.518+00
d626551a-bb8a-4a80-b177-38b3691f84e2	691f38c9-8367-405a-bf33-f7fab21ca05b	840c182b-642d-438d-b6ee-24f1e56833a3	unread	\N	\N	\N	\N	2026-07-27 21:37:09.518+00	2026-07-27 21:37:09.518+00
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.notifications (id, organization_id, outlet_id, user_id, type, severity, title, message, entity_type, entity_id, action_url, is_read, read_at, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.organizations (id, name, slug, timezone, currency, is_active, created_at, updated_at) FROM stdin;
3f964ae0-a43e-420b-95db-d5350d8ce754	Asihjaya	asihjaya	Asia/Jakarta	IDR	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
\.


--
-- Data for Name: outlets; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.outlets (id, organization_id, code, name, address, phone, google_maps_embed_url, is_active, created_at, updated_at) FROM stdin;
6eabe9d2-5b95-46c6-802b-f229e895bc9a	3f964ae0-a43e-420b-95db-d5350d8ce754	TOKO-BG	Bantar Gebang	Jl. Belakang Ps. Bantar Gebang, RT.003/RW.009, Bantargebang, Kec. Bantar Gebang, Kota Bks, Jawa Barat 17151	081234567868	https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3965.6233410898444!2d106.9880168!3d-6.3131108000000005!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69930059978a21%3A0x257754d7d88995d2!2sToko%20Emas%20Asih%20Jaya%20Bantar%20Gebang!5e0!3m2!1sen!2sid!4v1784745310463!5m2!1sen!2sid	t	2026-07-22 18:19:00.892838+00	2026-07-22 19:02:08.921+00
\.


--
-- Data for Name: payment_evidence_uploads; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.payment_evidence_uploads (id, organization_id, outlet_id, uploaded_by, storage_key, original_filename, size_bytes, sale_id, attached_at, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: payment_reconciliations; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.payment_reconciliations (id, organization_id, outlet_id, payment_id, status, expected_amount, settlement_gross_amount, fee_amount, tax_amount, net_settlement_amount, difference_amount, settlement_date, settlement_reference, evidence_key, notes, reconciled_by, reconciled_at, resolved_by, resolved_at, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payment_refunds; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.payment_refunds (id, organization_id, outlet_id, sale_id, payment_id, approval_id, original_shift_id, refund_shift_id, amount, method, provider, provider_reference, destination_masked, evidence_key, reason, status, idempotency_key, requested_by, approved_by, executed_by, confirmed_by, requested_at, approved_at, executed_at, confirmed_at, failure_code, failure_message, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.payments (id, sale_id, method, provider, amount, status, provider_reference, normalized_reference, external_order_id, verification_status, verification_source, provider_paid_at, verification_approval_id, co_verified_by, co_verified_at, evidence_key, manual_payment_profile_id, settlement_status, verified_by, verified_at, paid_at, metadata, created_at, updated_at) FROM stdin;
b83d3a0d-a8f6-44fb-84e0-d6ec0f451c64	b811bd6a-1e1a-4b1f-b3d3-738564db1116	cash	cash	1287000	paid	\N	\N	\N	self_verified	\N	\N	\N	\N	\N	\N	\N	not_applicable	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	2026-07-22 19:01:12.762+00	2026-07-22 19:01:12.762+00	{"note": null, "source": "pos.manual_payment_verification_v1", "methodLabel": "Cash", "changeAmount": 0, "receivedAmount": 1287000, "duplicatePaymentIds": [], "verificationDetails": {}, "makerCheckerEnforced": false, "manualPaymentProfile": null, "verificationFingerprint": null}	2026-07-22 19:01:12.762+00	2026-07-22 19:01:12.762+00
72ed7fdf-b268-483e-a71c-1650ca965dde	a05177cf-aa7d-4258-8526-fb36c838dc50	cash	cash	1812500	paid	\N	\N	\N	self_verified	\N	\N	\N	\N	\N	\N	\N	not_applicable	840c182b-642d-438d-b6ee-24f1e56833a3	2026-07-22 23:17:50.666+00	2026-07-22 23:17:50.666+00	{"note": null, "source": "pos.manual_payment_verification_v1", "methodLabel": "Cash", "changeAmount": 0, "receivedAmount": 1812500, "duplicatePaymentIds": [], "verificationDetails": {}, "makerCheckerEnforced": false, "manualPaymentProfile": null, "verificationFingerprint": null}	2026-07-22 23:17:50.666+00	2026-07-22 23:17:50.666+00
4aac615a-1199-44c1-9b74-de5362f85eee	baf96a0f-bf66-4fb2-8381-02a0b3e6f33d	cash	cash	2062500	paid	\N	\N	\N	self_verified	\N	\N	\N	\N	\N	\N	\N	not_applicable	840c182b-642d-438d-b6ee-24f1e56833a3	2026-07-23 08:11:56.008+00	2026-07-23 08:11:56.008+00	{"note": null, "source": "pos.manual_payment_verification_v1", "methodLabel": "Cash", "changeAmount": 0, "receivedAmount": 2062500, "duplicatePaymentIds": [], "verificationDetails": {}, "makerCheckerEnforced": false, "manualPaymentProfile": null, "customerDepositInAmount": "1600000", "verificationFingerprint": null, "customerDepositUsedAmount": "0"}	2026-07-23 08:11:56.008+00	2026-07-23 08:11:56.008+00
767760b1-94e0-4950-bb65-cf3ef1a3a483	baf96a0f-bf66-4fb2-8381-02a0b3e6f33d	cash	cash	1600000	paid	\N	\N	\N	self_verified	\N	\N	\N	\N	\N	\N	\N	not_applicable	840c182b-642d-438d-b6ee-24f1e56833a3	2026-07-23 08:11:56.008+00	2026-07-23 08:11:56.008+00	{"note": "Ibu siti membeli gelang wedding amara + titip uang 1,6jt", "source": "pos.manual_payment_verification_v1", "methodLabel": "Cash", "changeAmount": 0, "receivedAmount": 1600000, "duplicatePaymentIds": [], "verificationDetails": {}, "makerCheckerEnforced": false, "manualPaymentProfile": null, "customerDepositInAmount": "1600000", "verificationFingerprint": null, "customerDepositUsedAmount": "0"}	2026-07-23 08:11:56.008+00	2026-07-23 08:11:56.008+00
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.permissions (id, code, name, module, description, created_at, updated_at) FROM stdin;
39584095-680a-448f-be39-7b7da6a2cce4	admin.access	Mengakses dashboard admin	admin	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
94e63e77-605a-4d5a-9456-b68b642b9169	pos.access	Mengakses aplikasi POS	pos	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
66d99025-f72b-4c62-a887-f4c0f5e03cc5	staff.manage	Mengelola staff dan pengguna	administration	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
8e894854-27c3-49c1-bcb6-def2ae851b26	roles.manage	Mengelola role dan hak akses	administration	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
dae61013-0fd4-400b-be42-c186a12a8467	outlets.manage	Mengelola outlet dan register	operations	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
1b911fdc-7bf7-4f48-8105-1ba3792aba77	products.view	Melihat katalog produk	products	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
48e26b6e-94be-408c-8c35-1a56c604cb64	products.manage	Mengelola katalog produk	products	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
060633a7-10c1-455f-9ff5-e3ecc4bdee77	inventory.view	Melihat inventaris	inventory	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
51ef4f8e-24b5-4cf3-b44c-a2a6f4ae66f6	inventory.print_label	Mencetak label barcode inventaris	inventory	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
6cf41dd4-a7d3-4ebe-a8b0-129d97c2679c	inventory.receive	Menerima barang ke inventaris	inventory	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
4f0dfbf8-1724-4a7b-9cd1-48db6396dff8	inventory.adjust	Melakukan penyesuaian inventaris	inventory	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
f6e9b39b-cd07-496f-90f5-15d36aa23e1b	inventory.transfer	Memindahkan inventaris antar outlet	inventory	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
eeb8e2d0-49c2-45aa-8261-64dbde4f692a	inventory.manage	Mengelola seluruh inventaris (kompatibilitas)	inventory	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
c6aa5a7a-4563-46f6-8cb0-2dea85810a21	pricing.view_cost	Melihat harga modal produk	pricing	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
0fb592cf-ffaa-4e70-b649-b48a8517a242	pricing.manage	Mengelola harga dan rate logam	pricing	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
a49adef7-b09c-429c-8afb-afe43ccbecdb	sales.view	Melihat transaksi penjualan	sales	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
f7bf9fb0-9a72-4e1d-a44c-588604fdbf5b	sales.create	Membuat transaksi penjualan	sales	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
b8a7999f-67f2-4b15-ba1b-8586b2b69611	payments.manage	Mengelola pembayaran	payments	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
1a658ea1-6ebb-4cb4-bf15-394e8d3f9fac	payments.verify.manual	Memverifikasi pembayaran manual berisiko tinggi	payments	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
2458a48b-fad1-4a39-9e85-94241f95138b	payments.reconciliation.view	Melihat rekonsiliasi pembayaran	payments	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
f8ec119c-01b3-4ac4-8f39-4bc8fdcbb1e0	payments.reconciliation.manage	Mencatat rekonsiliasi pembayaran	payments	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
cf9b354a-8820-41ce-be1d-4fcf86d6b580	payments.reconciliation.resolve	Menyelesaikan mismatch rekonsiliasi	payments	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
f44e443c-7875-475f-87a9-1740020aa2c2	payments.reconciliation.import	Mengimpor settlement dan menjalankan auto-matching	payments	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
47247cd6-0f5a-4a61-98bb-2cccd2fd94a1	sales.void.request	Mengajukan void transaksi	sales	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
e8c2a22d-7c94-41ee-9f78-3472d83715e8	sales.void.approve	Menyetujui atau menolak void transaksi	sales	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
f087d0c6-ff63-4ece-a6b7-186f9370a578	sales.void.execute	Mengeksekusi void transaksi yang disetujui	sales	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
6fda344e-eda2-4289-9f55-19105b2fe0f6	payments.refund.request	Mengajukan refund pembayaran	payments	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
f37bb074-b5ef-4e16-90ac-7f4dce575c95	payments.refund.approve	Menyetujui atau menolak refund pembayaran	payments	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
180e6d06-455c-4205-b726-feb1cd91b885	payments.refund.execute	Mengeksekusi refund pembayaran yang disetujui	payments	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
c68a5e1d-42d8-4f1a-82ae-4838166901e7	returns.view	Melihat workflow retur dan pemeriksaan barang	inventory	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
290402f4-9c96-4765-ba12-4ce8b2b01d4d	returns.receive	Menerima barang retur dari customer	inventory	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
9b515bf6-d2ec-425e-bbb0-d0d443ce2ac1	returns.inspect	Memeriksa dan menentukan status barang retur	inventory	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
e5f12393-617a-4743-8641-3a3ef95c36a3	shifts.manage	Mengelola shift dan kas	operations	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
dc15d715-4e5a-4c94-a6fe-5798928ea1f8	reports.view	Melihat laporan	reports	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
bc091bf7-3a5e-4f0a-9137-65e63c140952	settings.manage	Mengubah pengaturan sistem	settings	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
6baeb989-c315-416a-b7c3-64e661886e10	hardware.resolve_unknown	Menyelesaikan hardware job dengan hasil tidak pasti	operations	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
1fde8e66-4d47-4db3-901a-7b8bc3a78e1f	audit.view	Melihat audit log	administration	\N	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
ee50522f-5361-4691-9ec9-3fea6b3548e1	customers.history_pin.manage	Membuat dan mereset PIN riwayat pelanggan	customers	Membuat PIN sementara, mereset PIN, dan mencabut sesi riwayat pelanggan.	2026-07-27 06:05:12.942552+00	2026-07-27 06:05:12.942552+00
\.


--
-- Data for Name: pos_checkout_attempts; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.pos_checkout_attempts (id, organization_id, outlet_id, register_id, shift_id, cashier_id, idempotency_key, request_fingerprint, status, sale_id, attempt_count, last_error_code, last_error_message, started_at, completed_at, failed_at, created_at, updated_at) FROM stdin;
a0874908-45cc-431e-bfc4-1fac4f80365c	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	066908eb-8d08-4676-a136-197b9af1a7fc	12a39630-334f-4567-a906-55daa8829c94	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	pos_3af1013e-3a4f-4e43-9b41-719abcc492e9	fe335f55b9c101bf7f87ddc8fd9bfb900b69e0352f9972dec0af72e1102a45d8	completed	b811bd6a-1e1a-4b1f-b3d3-738564db1116	1	\N	\N	2026-07-22 19:01:12.75+00	2026-07-22 19:01:12.838+00	\N	2026-07-22 19:01:12.75+00	2026-07-22 19:01:12.838+00
8472df4b-3a4d-4e6d-bc65-cb3929429a0d	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	3d4da573-4f97-4d7d-818d-69d53de29e24	840c182b-642d-438d-b6ee-24f1e56833a3	pos_0b956cf1-10f6-410f-865a-44892f11030a	1edca4cd9a34609d22345da7d182bc7f4913ad2dc7d24c5ec607aac36455a8b7	completed	a05177cf-aa7d-4258-8526-fb36c838dc50	1	\N	\N	2026-07-22 23:17:50.654+00	2026-07-22 23:17:50.718+00	\N	2026-07-22 23:17:50.654+00	2026-07-22 23:17:50.718+00
0d4fd135-6c4e-4de6-8877-1ed9e612c2b6	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	58c24186-e578-4f6b-91d4-5ebbc3bf0b64	840c182b-642d-438d-b6ee-24f1e56833a3	pos_dfafc2ba-2314-4ae3-8ede-daa9548995ba	3ffebaaa7da91cc4a9aa8c939c9bc80943a1f504db2bc2a7b4d70511d342f539	completed	baf96a0f-bf66-4fb2-8381-02a0b3e6f33d	1	\N	\N	2026-07-23 08:11:55.999+00	2026-07-23 08:11:56.067+00	\N	2026-07-23 08:11:55.999+00	2026-07-23 08:11:56.067+00
91099632-d6b2-4d7c-9a9f-5bb6358145b3	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	58c24186-e578-4f6b-91d4-5ebbc3bf0b64	840c182b-642d-438d-b6ee-24f1e56833a3	pos_db56dd2d-0d35-418f-8b5d-1be726a66a4d	ee2e6ccd84b70e089be86e7d370b3b832361da3fb75559bce7bef1513d232828	completed	902fd7b7-e2c9-4acb-8b4b-caa515a84592	1	\N	\N	2026-07-23 08:13:19.377+00	2026-07-23 08:13:19.422+00	\N	2026-07-23 08:13:19.377+00	2026-07-23 08:13:19.422+00
\.


--
-- Data for Name: pos_held_cart_items; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.pos_held_cart_items (id, held_cart_id, product_item_id, line_number, list_price_amount, discount_amount, final_price_amount, snapshot, is_active, released_at, created_at) FROM stdin;
\.


--
-- Data for Name: pos_held_carts; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.pos_held_carts (id, organization_id, outlet_id, register_id, shift_id, customer_id, held_by_user_id, hold_number, title, note, status, item_count, subtotal_amount, discount_amount, total_amount, resumed_at, resumed_by_user_id, canceled_at, canceled_by_user_id, cancel_reason, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: product_categories; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.product_categories (id, organization_id, parent_category_id, code, name, description, display_order, attribute_schema, is_active, created_at, updated_at) FROM stdin;
d946ca88-6c6f-4c5b-a0c3-13a30c55ab28	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	RING	Cincin	\N	10	{}	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
d6fb61cd-7039-4aeb-bffc-f1ad5e5d40d9	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	NECKLACE	Kalung	\N	20	{}	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
9cd8892b-39ce-4903-b1ca-fd6c8be89a84	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	BRACELET	Gelang	\N	30	{}	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
f2fea7ca-77c9-401f-af42-f4fdc990e913	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	EARRING	Anting	\N	40	{}	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
608ed919-61b5-429f-be32-db2908ed6fef	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	PENDANT	Liontin	\N	50	{}	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
4731f01c-6ef4-4f59-bc7b-c57409b02f6a	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	PRECIOUS_METAL	Logam Mulia	\N	60	{}	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
bafb59c7-7674-41e7-a1be-066d87a277b1	3f964ae0-a43e-420b-95db-d5350d8ce754	\N	ACCESSORY	Aksesori	\N	70	{}	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
\.


--
-- Data for Name: product_items; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.product_items (id, organization_id, product_master_id, display_name, current_outlet_id, sku, barcode, qr_value, serial_number, legacy_id, legacy_url, weight_gram, purity_percent, exchange_purity_percent, size, color, gemstone, cost_amount, selling_amount, price_per_gram, deduction_per_gram, availability, condition, location_state, location_code, image_key, attributes, internal_notes, is_active, created_at, updated_at) FROM stdin;
4a633615-c71d-4221-a6e9-43f31a87c433	3f964ae0-a43e-420b-95db-d5350d8ce754	0bdd002c-78a4-41fe-944c-97fe439a7fa6	Gelang Solitare Aurelia	6eabe9d2-5b95-46c6-802b-f229e895bc9a	AJ-ITEM-00000003	AJ00000003	AJ00000003	\N	\N	\N	1.650	65.800	11.000	10	Kuning	Berlian	870000	1287000	780000	145000	sold	good	customer	ETALASE-B-01	organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/items/4a633615-c71d-4221-a6e9-43f31a87c433/ce533bda-5f30-4267-90a1-16f322290c6c.webp	{}	\N	t	2026-07-22 18:55:15.348528+00	2026-07-22 19:01:12.762+00
2aab6804-23c0-435b-8b4d-495700a86365	3f964ae0-a43e-420b-95db-d5350d8ce754	2fcd87b7-2654-4a9f-a1f7-1f187c34bac7	Aurelia Amethyst Ring	6eabe9d2-5b95-46c6-802b-f229e895bc9a	AJ-ITEM-00000002	AJ00000002	AJ00000002	\N	\N	\N	1.250	35.200	11.000	8	Poles	Berlian	1550000	1812500	1450000	150000	sold	good	customer	ETALASE-A-02	organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/items/2aab6804-23c0-435b-8b4d-495700a86365/1badbfe9-47f0-4d67-a490-e048406b97f9.webp	{}	\N	t	2026-07-22 18:52:41.649001+00	2026-07-22 23:17:50.666+00
3d288805-cfce-40cb-baa7-83ec95d48219	3f964ae0-a43e-420b-95db-d5350d8ce754	0bdd002c-78a4-41fe-944c-97fe439a7fa6	Gelang Wedding Amara	6eabe9d2-5b95-46c6-802b-f229e895bc9a	AJ-ITEM-00000004	AJ00000004	AJ00000004	\N	\N	\N	2.750	18.500	32.000	12	Kuning	Berlian	800000	2062500	750000	55000	sold	good	customer	ETALASE-B-02	organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/items/3d288805-cfce-40cb-baa7-83ec95d48219/238f71b6-d378-42dd-a648-a24eb46b586c.webp	{}	\N	t	2026-07-22 18:57:24.720048+00	2026-07-23 08:11:56.008+00
55106de5-7d80-49ef-924b-602241c445e3	3f964ae0-a43e-420b-95db-d5350d8ce754	2fcd87b7-2654-4a9f-a1f7-1f187c34bac7	Aurelia Gold Ring	6eabe9d2-5b95-46c6-802b-f229e895bc9a	AJ-ITEM-00000001	AJ00000001	AJ00000001	\N	\N	\N	2.750	35.200	11.000	10	Poles	Tanpa Batu	970000	1450000	875000	125000	sold	good	customer	ETALASE-A-01	organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/items/55106de5-7d80-49ef-924b-602241c445e3/91a868f7-8678-4912-aefc-e7c2e64ee180.webp	{}	\N	t	2026-07-22 18:50:41.881296+00	2026-07-23 08:13:19.384+00
8f21c222-d2fa-4fb8-ad5b-a5467269af00	3f964ae0-a43e-420b-95db-d5350d8ce754	0bdd002c-78a4-41fe-944c-97fe439a7fa6	Isodora Gold Ring	6eabe9d2-5b95-46c6-802b-f229e895bc9a	AJ-ITEM-00000005	AJ00000005	AJ00000005	\N	\N	\N	1.250	35.200	48.000	8	Rose Gold	Zircon	700000	1250000	650000	350000	available	good	outlet	ETALASE-B-01	organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/items/8f21c222-d2fa-4fb8-ad5b-a5467269af00/8850bdae-6508-403e-ad3d-e04f5994b183.webp	{}	\N	t	2026-07-23 08:19:15.561021+00	2026-07-23 08:19:15.561021+00
\.


--
-- Data for Name: product_masters; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.product_masters (id, organization_id, category_id, code, name, brand, material, collection, description, image_key, attributes, status, created_at, updated_at) FROM stdin;
2fcd87b7-2654-4a9f-a1f7-1f187c34bac7	3f964ae0-a43e-420b-95db-d5350d8ce754	d946ca88-6c6f-4c5b-a0c3-13a30c55ab28	RING-AURELIA	Cincin Solitaire Aurelia	ASIHJAYA	\N	Aurelia	\N	organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/products/2fcd87b7-2654-4a9f-a1f7-1f187c34bac7/c97a3275-2e93-4dda-acaa-c3a070de4fe6.webp	{}	active	2026-07-22 18:49:33.916117+00	2026-07-22 18:49:33.916117+00
0bdd002c-78a4-41fe-944c-97fe439a7fa6	3f964ae0-a43e-420b-95db-d5350d8ce754	9cd8892b-39ce-4903-b1ca-fd6c8be89a84	WEDDING-BRACELET	Gelang Solitaire Aurelia	ASIHJAYA	\N	Wedding	\N	organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/products/0bdd002c-78a4-41fe-944c-97fe439a7fa6/163f16ea-e45e-4a65-b116-30098a7278ca.webp	{}	active	2026-07-22 18:54:07.674932+00	2026-07-22 18:54:07.674932+00
\.


--
-- Data for Name: registers; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.registers (id, outlet_id, code, name, is_hardware_hub, is_active, created_at, updated_at) FROM stdin;
36961177-52d1-45e7-ba0c-d1bf785ce2da	6eabe9d2-5b95-46c6-802b-f229e895bc9a	POS-BG1	Kasir Bantar Gebang 1	t	t	2026-07-22 18:19:00.892838+00	2026-07-22 19:14:24.68+00
066908eb-8d08-4676-a136-197b9af1a7fc	6eabe9d2-5b95-46c6-802b-f229e895bc9a	POS-02	POS Sales	f	f	2026-07-22 18:59:25.40819+00	2026-07-23 00:09:38.858+00
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.role_permissions (id, role_id, permission_id, constraints) FROM stdin;
2778a16a-2821-4420-8c74-f78e892074e2	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	39584095-680a-448f-be39-7b7da6a2cce4	\N
ec27d9d1-3d68-4581-a4a4-f77ed4c43bb5	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	94e63e77-605a-4d5a-9456-b68b642b9169	\N
eef69221-2f1a-4ce9-9c00-4a981ffa5aee	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	66d99025-f72b-4c62-a887-f4c0f5e03cc5	\N
24cf7810-01f1-4570-981f-9221d349da08	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	8e894854-27c3-49c1-bcb6-def2ae851b26	\N
8bf8972a-622b-4ad0-bfae-0570d456b1e3	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	dae61013-0fd4-400b-be42-c186a12a8467	\N
a6e23cfb-b419-40af-82bd-1ae4fc880178	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	1b911fdc-7bf7-4f48-8105-1ba3792aba77	\N
c21a8942-5c08-4ab2-b00b-1053cee40390	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	48e26b6e-94be-408c-8c35-1a56c604cb64	\N
bae3896a-99a3-46cd-a5a2-df12332c03ad	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	060633a7-10c1-455f-9ff5-e3ecc4bdee77	\N
37b9073e-d555-4a40-8684-282408cc6125	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	51ef4f8e-24b5-4cf3-b44c-a2a6f4ae66f6	\N
fa1e3346-c681-4aca-97a5-126bfcc97112	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	6cf41dd4-a7d3-4ebe-a8b0-129d97c2679c	\N
0ba97cd9-36ea-4a19-a3b4-f3db1ab8d7c3	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	4f0dfbf8-1724-4a7b-9cd1-48db6396dff8	\N
063542aa-8d4b-4796-a1e2-9ca2973b6f31	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	f6e9b39b-cd07-496f-90f5-15d36aa23e1b	\N
4757524f-c3ef-455f-9331-d151bf7caf45	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	eeb8e2d0-49c2-45aa-8261-64dbde4f692a	\N
435448f5-998b-4375-a528-354f594e7821	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	c6aa5a7a-4563-46f6-8cb0-2dea85810a21	\N
19ff1e1e-c3d7-4be7-b2d7-69738a886227	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	0fb592cf-ffaa-4e70-b649-b48a8517a242	\N
8b249865-d9de-4be6-8070-cbf29e0bd283	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	a49adef7-b09c-429c-8afb-afe43ccbecdb	\N
9037b1ad-1eae-4634-8c8b-adb2f7b4959e	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	f7bf9fb0-9a72-4e1d-a44c-588604fdbf5b	\N
35ecfbff-bc14-49fb-af03-f8597563d742	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	b8a7999f-67f2-4b15-ba1b-8586b2b69611	\N
bdc2665d-6987-4dea-b90b-ed1c7823f211	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	1a658ea1-6ebb-4cb4-bf15-394e8d3f9fac	\N
b885a91a-a321-4e29-bcdb-29ca6edf66f4	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	2458a48b-fad1-4a39-9e85-94241f95138b	\N
b2bfabda-873b-4c7e-89bf-3196690d8630	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	f8ec119c-01b3-4ac4-8f39-4bc8fdcbb1e0	\N
fb5c7ed8-d551-4f41-b0a1-305ef6c543fa	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	cf9b354a-8820-41ce-be1d-4fcf86d6b580	\N
f072a007-9e3f-4e42-afa6-3d542d391b1c	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	f44e443c-7875-475f-87a9-1740020aa2c2	\N
46ca9bee-42af-42e6-826b-db25130dd508	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	47247cd6-0f5a-4a61-98bb-2cccd2fd94a1	\N
76ade3e2-2d7c-4ff2-8792-24c44036abed	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	e8c2a22d-7c94-41ee-9f78-3472d83715e8	\N
0c5c8e16-c941-4a5f-874b-0fa24252eb4f	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	f087d0c6-ff63-4ece-a6b7-186f9370a578	\N
c012625b-1326-4803-a4cd-c69d7a6a5b60	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	6fda344e-eda2-4289-9f55-19105b2fe0f6	\N
7694cb03-b5c8-41fe-864a-3d3912857e54	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	f37bb074-b5ef-4e16-90ac-7f4dce575c95	\N
07ee0da4-cf90-43f2-934b-09e7ce84084f	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	180e6d06-455c-4205-b726-feb1cd91b885	\N
b1a6c722-5d6c-4b03-93f8-5c0e06837e06	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	c68a5e1d-42d8-4f1a-82ae-4838166901e7	\N
5a7fdafc-155c-442c-9b2b-2321ef8d0216	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	290402f4-9c96-4765-ba12-4ce8b2b01d4d	\N
92b99f02-7d16-4516-936f-eb12bc93b2a9	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	9b515bf6-d2ec-425e-bbb0-d0d443ce2ac1	\N
e342ba2b-ebeb-42b4-baf7-244f21378249	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	e5f12393-617a-4743-8641-3a3ef95c36a3	\N
97264c19-be1a-418b-a9b9-f1c90e4c0b0f	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	dc15d715-4e5a-4c94-a6fe-5798928ea1f8	\N
0eee3e1e-36c7-4eca-b824-5686fdc08c19	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	bc091bf7-3a5e-4f0a-9137-65e63c140952	\N
e92b269b-7ed1-4969-8471-9ca0d401e63f	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	6baeb989-c315-416a-b7c3-64e661886e10	\N
d6ad0863-5eeb-405b-a5d2-61b6e66ffe7f	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	1fde8e66-4d47-4db3-901a-7b8bc3a78e1f	\N
5247617c-b46f-4f45-b0ed-81f555010dd2	647d23a2-b700-4eba-92bd-1b247ce4aeae	39584095-680a-448f-be39-7b7da6a2cce4	\N
cb6a0001-19b6-4fcf-be5c-161634fa623c	647d23a2-b700-4eba-92bd-1b247ce4aeae	94e63e77-605a-4d5a-9456-b68b642b9169	\N
74db02e6-da21-45c8-b27c-8f464fb61212	647d23a2-b700-4eba-92bd-1b247ce4aeae	66d99025-f72b-4c62-a887-f4c0f5e03cc5	\N
2e1450d8-8370-4408-965c-963f7d442228	647d23a2-b700-4eba-92bd-1b247ce4aeae	8e894854-27c3-49c1-bcb6-def2ae851b26	\N
23c75498-444b-41f7-b7f9-0991aba71b93	647d23a2-b700-4eba-92bd-1b247ce4aeae	dae61013-0fd4-400b-be42-c186a12a8467	\N
a55cb486-b566-40bb-9614-445b603a7567	647d23a2-b700-4eba-92bd-1b247ce4aeae	1b911fdc-7bf7-4f48-8105-1ba3792aba77	\N
3e13f4b6-25e8-4529-afa8-5226ac82102c	647d23a2-b700-4eba-92bd-1b247ce4aeae	48e26b6e-94be-408c-8c35-1a56c604cb64	\N
5b74d5ce-f086-4b8f-b084-74d6c5d0e7da	647d23a2-b700-4eba-92bd-1b247ce4aeae	060633a7-10c1-455f-9ff5-e3ecc4bdee77	\N
66f74cc8-6378-4bf5-a7c9-89ed784a6c43	647d23a2-b700-4eba-92bd-1b247ce4aeae	51ef4f8e-24b5-4cf3-b44c-a2a6f4ae66f6	\N
0f80518f-98ed-48db-9380-bcf45b495b99	647d23a2-b700-4eba-92bd-1b247ce4aeae	6cf41dd4-a7d3-4ebe-a8b0-129d97c2679c	\N
cc8a16c0-ee12-41f4-9b3c-1918e4ff6299	647d23a2-b700-4eba-92bd-1b247ce4aeae	4f0dfbf8-1724-4a7b-9cd1-48db6396dff8	\N
7445b051-228b-4a3c-a4ad-846dd9a8b505	647d23a2-b700-4eba-92bd-1b247ce4aeae	f6e9b39b-cd07-496f-90f5-15d36aa23e1b	\N
399ddb72-e977-4328-9339-469b821f6285	647d23a2-b700-4eba-92bd-1b247ce4aeae	eeb8e2d0-49c2-45aa-8261-64dbde4f692a	\N
ece9e184-6aec-4a02-8197-02c484512f36	647d23a2-b700-4eba-92bd-1b247ce4aeae	c6aa5a7a-4563-46f6-8cb0-2dea85810a21	\N
a7b440ab-46ea-4091-84b5-7d82431d985d	647d23a2-b700-4eba-92bd-1b247ce4aeae	0fb592cf-ffaa-4e70-b649-b48a8517a242	\N
3ffdbb70-dac9-48a1-93a8-2a4d30259ef7	647d23a2-b700-4eba-92bd-1b247ce4aeae	a49adef7-b09c-429c-8afb-afe43ccbecdb	\N
f941c981-4f9f-4257-974e-e378d9579303	647d23a2-b700-4eba-92bd-1b247ce4aeae	f7bf9fb0-9a72-4e1d-a44c-588604fdbf5b	\N
942c84ad-e5f3-4e7e-a8c1-c94c43f20ab2	647d23a2-b700-4eba-92bd-1b247ce4aeae	b8a7999f-67f2-4b15-ba1b-8586b2b69611	\N
59ec0613-df9d-497c-9e6a-0b491fd756ee	647d23a2-b700-4eba-92bd-1b247ce4aeae	1a658ea1-6ebb-4cb4-bf15-394e8d3f9fac	\N
3a99b987-732c-4b58-a214-e63de3ba81fb	647d23a2-b700-4eba-92bd-1b247ce4aeae	2458a48b-fad1-4a39-9e85-94241f95138b	\N
ca9fd43e-1dbc-4399-b6fa-4004af9a7c2b	647d23a2-b700-4eba-92bd-1b247ce4aeae	f8ec119c-01b3-4ac4-8f39-4bc8fdcbb1e0	\N
8e6aa62c-5d8e-4352-b472-06375e14dfc3	647d23a2-b700-4eba-92bd-1b247ce4aeae	cf9b354a-8820-41ce-be1d-4fcf86d6b580	\N
064b40da-446a-4881-b617-cf6eea75a36f	647d23a2-b700-4eba-92bd-1b247ce4aeae	f44e443c-7875-475f-87a9-1740020aa2c2	\N
66b29f56-589d-48c0-aa20-4dc01b0486e7	647d23a2-b700-4eba-92bd-1b247ce4aeae	47247cd6-0f5a-4a61-98bb-2cccd2fd94a1	\N
26b797ab-e5ae-46b3-bf5f-4ae0c0421d89	647d23a2-b700-4eba-92bd-1b247ce4aeae	e8c2a22d-7c94-41ee-9f78-3472d83715e8	\N
6a1d5db4-faf2-4268-91fe-9543c9df83d4	647d23a2-b700-4eba-92bd-1b247ce4aeae	f087d0c6-ff63-4ece-a6b7-186f9370a578	\N
d05a31f2-79ee-4646-b634-fcab3d6a15b4	647d23a2-b700-4eba-92bd-1b247ce4aeae	6fda344e-eda2-4289-9f55-19105b2fe0f6	\N
89de2db6-0afb-46bf-a54c-af42603638df	647d23a2-b700-4eba-92bd-1b247ce4aeae	f37bb074-b5ef-4e16-90ac-7f4dce575c95	\N
48ef8331-5b91-4517-ae15-c43d3c2ff738	647d23a2-b700-4eba-92bd-1b247ce4aeae	180e6d06-455c-4205-b726-feb1cd91b885	\N
04f51480-6484-4041-81d7-088238d5de21	647d23a2-b700-4eba-92bd-1b247ce4aeae	c68a5e1d-42d8-4f1a-82ae-4838166901e7	\N
5a36d614-c435-4876-9629-a4713e8e9553	647d23a2-b700-4eba-92bd-1b247ce4aeae	290402f4-9c96-4765-ba12-4ce8b2b01d4d	\N
1a4f51f6-5dc1-4927-9f3e-4f52e53c97f0	647d23a2-b700-4eba-92bd-1b247ce4aeae	9b515bf6-d2ec-425e-bbb0-d0d443ce2ac1	\N
dd24c320-5d50-47b1-ae35-900c22ee4cbc	647d23a2-b700-4eba-92bd-1b247ce4aeae	e5f12393-617a-4743-8641-3a3ef95c36a3	\N
b5e87efa-40ed-4731-9318-60151efbe886	647d23a2-b700-4eba-92bd-1b247ce4aeae	dc15d715-4e5a-4c94-a6fe-5798928ea1f8	\N
b5c065c8-b466-441d-8d04-7c813f09f141	647d23a2-b700-4eba-92bd-1b247ce4aeae	bc091bf7-3a5e-4f0a-9137-65e63c140952	\N
39236acc-136c-4f5e-a72c-190a23ee9822	647d23a2-b700-4eba-92bd-1b247ce4aeae	6baeb989-c315-416a-b7c3-64e661886e10	\N
c763e739-cdaf-4f1e-b7ef-fbc106e374dd	647d23a2-b700-4eba-92bd-1b247ce4aeae	1fde8e66-4d47-4db3-901a-7b8bc3a78e1f	\N
896e4879-6083-43f9-97b5-95bc079c4241	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	39584095-680a-448f-be39-7b7da6a2cce4	\N
051fd947-0ffa-461a-b71d-a8994f2125d3	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	94e63e77-605a-4d5a-9456-b68b642b9169	\N
8b25efbf-fb22-464c-aaa2-0a4b73a71ebb	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	dae61013-0fd4-400b-be42-c186a12a8467	\N
8f2e0e03-00f9-4a41-b488-8b39d56b0fa7	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	1b911fdc-7bf7-4f48-8105-1ba3792aba77	\N
cd996800-4b4a-4ce1-a748-3e311f094a97	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	48e26b6e-94be-408c-8c35-1a56c604cb64	\N
53833265-410f-42c4-8523-5cf3ed36893c	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	060633a7-10c1-455f-9ff5-e3ecc4bdee77	\N
8ddf6667-40f4-4506-8ace-2639eaca7bec	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	51ef4f8e-24b5-4cf3-b44c-a2a6f4ae66f6	\N
b8292007-a03a-40d9-9ae4-d96e2a0f792a	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	6cf41dd4-a7d3-4ebe-a8b0-129d97c2679c	\N
3b3a2a47-e3f0-4b38-a8c9-c8e52fa2dd72	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	4f0dfbf8-1724-4a7b-9cd1-48db6396dff8	\N
04cb0213-a0e7-41b3-8d8e-2a64273f8d3b	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	f6e9b39b-cd07-496f-90f5-15d36aa23e1b	\N
1c47066f-039a-4ca9-bcdf-7f5b36396eec	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	c6aa5a7a-4563-46f6-8cb0-2dea85810a21	\N
fdb69d19-d07e-4e76-8b96-059576d37963	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	0fb592cf-ffaa-4e70-b649-b48a8517a242	\N
941a01fe-23cd-41c9-966b-8afb6bc5afff	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	a49adef7-b09c-429c-8afb-afe43ccbecdb	\N
6c0d4cad-7962-4585-9aef-a92389634c35	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	f7bf9fb0-9a72-4e1d-a44c-588604fdbf5b	\N
1207c7c8-22bb-4a58-aab4-388b5d663c4d	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	b8a7999f-67f2-4b15-ba1b-8586b2b69611	\N
8ab0dc7e-a032-4769-8d43-e1ce6cb018c7	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	1a658ea1-6ebb-4cb4-bf15-394e8d3f9fac	\N
fb7ba1fe-dd2d-46a9-a2b5-3102c9784d98	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	2458a48b-fad1-4a39-9e85-94241f95138b	\N
d5b9535a-ad1a-4973-9dc0-a78969a7228f	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	f8ec119c-01b3-4ac4-8f39-4bc8fdcbb1e0	\N
89449d35-3805-407b-832f-47f21f007e00	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	cf9b354a-8820-41ce-be1d-4fcf86d6b580	\N
80822c2b-1128-487b-bcf9-ef57250778cc	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	f44e443c-7875-475f-87a9-1740020aa2c2	\N
fe7ab812-2064-4f7b-9df4-1f285956efb7	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	47247cd6-0f5a-4a61-98bb-2cccd2fd94a1	\N
086cedec-1f76-4766-b7aa-c16a57f589b7	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	e8c2a22d-7c94-41ee-9f78-3472d83715e8	\N
d1335b37-4824-4f45-b76f-01c44d7872ae	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	f087d0c6-ff63-4ece-a6b7-186f9370a578	\N
f73181bc-ee3d-40a6-821c-b9bb878f0f5d	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	6fda344e-eda2-4289-9f55-19105b2fe0f6	\N
654d57e5-6ed1-43b3-a06e-864208c150ab	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	f37bb074-b5ef-4e16-90ac-7f4dce575c95	\N
2e5b40ce-0da0-492a-85d4-8f01e115f3f5	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	180e6d06-455c-4205-b726-feb1cd91b885	\N
62bc1aa1-e1d9-4603-9b6b-ff2b8fe1cbc1	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	c68a5e1d-42d8-4f1a-82ae-4838166901e7	\N
5f20974b-ea73-424a-9000-af256207600d	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	290402f4-9c96-4765-ba12-4ce8b2b01d4d	\N
84e815d8-a4ce-41aa-8580-89fc94e23989	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	9b515bf6-d2ec-425e-bbb0-d0d443ce2ac1	\N
2de118b9-1c5b-4fbf-8666-24335db9bc85	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	e5f12393-617a-4743-8641-3a3ef95c36a3	\N
126cdab6-ba97-4d7a-b3ff-0c6985a9d65e	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	6baeb989-c315-416a-b7c3-64e661886e10	\N
d4618ff4-87fb-4997-8226-03c1fd1fe9c0	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	dc15d715-4e5a-4c94-a6fe-5798928ea1f8	\N
9af79825-7fc6-45d9-b14f-8d79790d0d5e	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	1fde8e66-4d47-4db3-901a-7b8bc3a78e1f	\N
55761f10-01f0-4a4a-a04b-3b1625a60b3b	c4175cc4-aa06-4364-bee9-66d84cc6f13c	94e63e77-605a-4d5a-9456-b68b642b9169	\N
279ebf94-c34a-4fb9-b834-ff2c075873d8	c4175cc4-aa06-4364-bee9-66d84cc6f13c	1b911fdc-7bf7-4f48-8105-1ba3792aba77	\N
565427aa-0f62-4dfb-81b4-064291f67b6f	c4175cc4-aa06-4364-bee9-66d84cc6f13c	060633a7-10c1-455f-9ff5-e3ecc4bdee77	\N
12c05d6d-4606-453e-8af2-c4e6cae76f8b	c4175cc4-aa06-4364-bee9-66d84cc6f13c	a49adef7-b09c-429c-8afb-afe43ccbecdb	\N
c07d2bc0-4aae-4cd3-a720-712c74e0e001	c4175cc4-aa06-4364-bee9-66d84cc6f13c	f7bf9fb0-9a72-4e1d-a44c-588604fdbf5b	\N
07161a8a-215d-42c1-84d5-5c669cb29688	c4175cc4-aa06-4364-bee9-66d84cc6f13c	b8a7999f-67f2-4b15-ba1b-8586b2b69611	\N
bc34553c-8f4a-43da-96b1-091d2f048e62	c4175cc4-aa06-4364-bee9-66d84cc6f13c	47247cd6-0f5a-4a61-98bb-2cccd2fd94a1	\N
3506d8b5-d6e0-4f8c-82c1-0ea45849dab9	c4175cc4-aa06-4364-bee9-66d84cc6f13c	6fda344e-eda2-4289-9f55-19105b2fe0f6	\N
ac9a37ec-edc6-4b5a-8b83-c4bef2592045	c4175cc4-aa06-4364-bee9-66d84cc6f13c	c68a5e1d-42d8-4f1a-82ae-4838166901e7	\N
be1eebbc-a371-4390-8756-1a1ce7d6b34e	c4175cc4-aa06-4364-bee9-66d84cc6f13c	290402f4-9c96-4765-ba12-4ce8b2b01d4d	\N
658487e1-710f-49ec-aa79-740be85a6098	c4175cc4-aa06-4364-bee9-66d84cc6f13c	e5f12393-617a-4743-8641-3a3ef95c36a3	\N
de395ed0-2eb7-42f9-afce-97a3e0cfbe88	58275284-31ee-47b6-8b75-a4cbfe9a63dc	39584095-680a-448f-be39-7b7da6a2cce4	\N
56c0be79-5520-499f-a0f2-313ca54e8a04	58275284-31ee-47b6-8b75-a4cbfe9a63dc	1b911fdc-7bf7-4f48-8105-1ba3792aba77	\N
f0bcf47b-5124-4a6a-97bf-1489679d68e6	58275284-31ee-47b6-8b75-a4cbfe9a63dc	48e26b6e-94be-408c-8c35-1a56c604cb64	\N
8510427d-78ae-4b54-ab96-3a936979da02	58275284-31ee-47b6-8b75-a4cbfe9a63dc	060633a7-10c1-455f-9ff5-e3ecc4bdee77	\N
7a600976-9070-4c4d-919c-967fe338922a	58275284-31ee-47b6-8b75-a4cbfe9a63dc	51ef4f8e-24b5-4cf3-b44c-a2a6f4ae66f6	\N
42f2d4d4-b65f-465e-8711-493c919faec7	58275284-31ee-47b6-8b75-a4cbfe9a63dc	6cf41dd4-a7d3-4ebe-a8b0-129d97c2679c	\N
9093fcf6-98ec-4943-aa0a-49aa6162469a	58275284-31ee-47b6-8b75-a4cbfe9a63dc	4f0dfbf8-1724-4a7b-9cd1-48db6396dff8	\N
3fddc66f-9b67-4bba-90cc-721946905bf6	58275284-31ee-47b6-8b75-a4cbfe9a63dc	f6e9b39b-cd07-496f-90f5-15d36aa23e1b	\N
1a4b6361-f008-4d11-ac41-076bb9455e30	58275284-31ee-47b6-8b75-a4cbfe9a63dc	c6aa5a7a-4563-46f6-8cb0-2dea85810a21	\N
47b5980a-24d6-42d6-bbad-20882ef656e7	58275284-31ee-47b6-8b75-a4cbfe9a63dc	0fb592cf-ffaa-4e70-b649-b48a8517a242	\N
7c904693-a14e-4e95-956b-9303a8626958	58275284-31ee-47b6-8b75-a4cbfe9a63dc	a49adef7-b09c-429c-8afb-afe43ccbecdb	\N
88eaa1f0-e005-4176-a1a1-b6f5b1caf16d	58275284-31ee-47b6-8b75-a4cbfe9a63dc	c68a5e1d-42d8-4f1a-82ae-4838166901e7	\N
3756cba8-ea35-4436-9cee-b0bb6a6ee7ae	58275284-31ee-47b6-8b75-a4cbfe9a63dc	290402f4-9c96-4765-ba12-4ce8b2b01d4d	\N
1105c3cb-21e1-484a-a559-216cafaaeffb	58275284-31ee-47b6-8b75-a4cbfe9a63dc	9b515bf6-d2ec-425e-bbb0-d0d443ce2ac1	\N
641928ca-4499-4022-b9a4-9b51df1456dd	3542c43d-6ae4-450a-bc2d-b34d8fe88428	39584095-680a-448f-be39-7b7da6a2cce4	\N
4884c2d7-03c6-4d37-8ada-c50ce180c11d	3542c43d-6ae4-450a-bc2d-b34d8fe88428	1b911fdc-7bf7-4f48-8105-1ba3792aba77	\N
ccf71e09-94af-4467-be48-afaec4b49ce0	3542c43d-6ae4-450a-bc2d-b34d8fe88428	c6aa5a7a-4563-46f6-8cb0-2dea85810a21	\N
67fd4cf1-b2cd-4bbd-bade-6032a261c4b6	3542c43d-6ae4-450a-bc2d-b34d8fe88428	a49adef7-b09c-429c-8afb-afe43ccbecdb	\N
5eb9da0a-9274-4021-aada-56e253f73d5d	3542c43d-6ae4-450a-bc2d-b34d8fe88428	b8a7999f-67f2-4b15-ba1b-8586b2b69611	\N
e18a4889-2578-408f-b0f2-facba57dfb44	3542c43d-6ae4-450a-bc2d-b34d8fe88428	1a658ea1-6ebb-4cb4-bf15-394e8d3f9fac	\N
c46bb957-5522-4a42-9258-4819997601d9	3542c43d-6ae4-450a-bc2d-b34d8fe88428	2458a48b-fad1-4a39-9e85-94241f95138b	\N
f7209521-a10d-4f3a-a0cd-34dfa43aacc5	3542c43d-6ae4-450a-bc2d-b34d8fe88428	f8ec119c-01b3-4ac4-8f39-4bc8fdcbb1e0	\N
ef9609b3-ebd7-4115-8308-1ef552637ccd	3542c43d-6ae4-450a-bc2d-b34d8fe88428	cf9b354a-8820-41ce-be1d-4fcf86d6b580	\N
047df2aa-38d4-4667-b4d0-f6e6d6afa66e	3542c43d-6ae4-450a-bc2d-b34d8fe88428	f44e443c-7875-475f-87a9-1740020aa2c2	\N
e96d5605-a60b-4c1f-85a7-ad9aa0822232	3542c43d-6ae4-450a-bc2d-b34d8fe88428	f37bb074-b5ef-4e16-90ac-7f4dce575c95	\N
20185b48-5873-4606-8a1e-6fc62690029f	3542c43d-6ae4-450a-bc2d-b34d8fe88428	180e6d06-455c-4205-b726-feb1cd91b885	\N
b7c4e1cb-5a4c-420c-8ec1-3e0443319f2f	3542c43d-6ae4-450a-bc2d-b34d8fe88428	c68a5e1d-42d8-4f1a-82ae-4838166901e7	\N
759796cd-2221-4c02-8cae-f3d55a06cde3	3542c43d-6ae4-450a-bc2d-b34d8fe88428	dc15d715-4e5a-4c94-a6fe-5798928ea1f8	\N
d42f612b-7506-42d2-af5c-95341b3f57ae	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	ee50522f-5361-4691-9ec9-3fea6b3548e1	\N
f7012dc6-d9b6-495e-96eb-1e1b82ce2ff2	647d23a2-b700-4eba-92bd-1b247ce4aeae	ee50522f-5361-4691-9ec9-3fea6b3548e1	\N
e8b31ffb-b66a-4f37-bc25-2c29d005bec1	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	ee50522f-5361-4691-9ec9-3fea6b3548e1	\N
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.roles (id, organization_id, code, name, description, is_system, is_active, created_at, updated_at) FROM stdin;
5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	3f964ae0-a43e-420b-95db-d5350d8ce754	system_admin	System Administrator	Mengelola konfigurasi teknis dan seluruh modul sistem.	t	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
647d23a2-b700-4eba-92bd-1b247ce4aeae	3f964ae0-a43e-420b-95db-d5350d8ce754	owner	Owner	Akses penuh untuk kebutuhan bisnis dan laporan.	t	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
acfcbb18-c1c1-4540-bb72-ffdcdf88f757	3f964ae0-a43e-420b-95db-d5350d8ce754	manager	Manager	Mengelola operasional outlet dan approval.	t	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
c4175cc4-aa06-4364-bee9-66d84cc6f13c	3f964ae0-a43e-420b-95db-d5350d8ce754	cashier	Kasir	Memproses transaksi, pembayaran, dan shift.	t	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
58275284-31ee-47b6-8b75-a4cbfe9a63dc	3f964ae0-a43e-420b-95db-d5350d8ce754	stock_admin	Admin Stok	Mengelola produk, item, dan inventaris.	t	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
3542c43d-6ae4-450a-bc2d-b34d8fe88428	3f964ae0-a43e-420b-95db-d5350d8ce754	finance	Finance	Mengakses pembayaran dan laporan keuangan.	t	t	2026-07-22 18:19:00.892838+00	2026-07-22 18:19:00.892838+00
\.


--
-- Data for Name: sale_items; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.sale_items (id, sale_id, product_item_id, line_number, list_price_amount, discount_amount, final_price_amount, snapshot, created_at) FROM stdin;
e37eec70-5924-4538-8e6c-21e2464a24b3	b811bd6a-1e1a-4b1f-b3d3-738564db1116	4a633615-c71d-4221-a6e9-43f31a87c433	1	1287000	0	1287000	{"sku": "AJ-ITEM-00000003", "size": "10", "color": "Kuning", "barcode": "AJ00000003", "qrValue": "AJ00000003", "gemstone": "Berlian", "imageKey": "organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/items/4a633615-c71d-4221-a6e9-43f31a87c433/ce533bda-5f30-4267-90a1-16f322290c6c.webp", "categoryId": "9cd8892b-39ce-4903-b1ca-fd6c8be89a84", "weightGram": "1.650", "productCode": "WEDDING-BRACELET", "productName": "Gelang Solitare Aurelia", "categoryCode": "BRACELET", "categoryName": "Gelang", "serialNumber": null, "purityPercent": "65.800", "sellingAmount": "1287000", "itemDisplayName": "Gelang Solitare Aurelia", "productImageKey": "organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/products/0bdd002c-78a4-41fe-944c-97fe439a7fa6/163f16ea-e45e-4a65-b116-30098a7278ca.webp", "productMasterId": "0bdd002c-78a4-41fe-944c-97fe439a7fa6", "masterProductName": "Gelang Solitaire Aurelia", "exchangePurityPercent": "11.000"}	2026-07-22 19:01:12.762+00
82c4683a-a4d6-46ad-9f97-a0ee66d7c0dd	a05177cf-aa7d-4258-8526-fb36c838dc50	2aab6804-23c0-435b-8b4d-495700a86365	1	1812500	0	1812500	{"sku": "AJ-ITEM-00000002", "size": "8", "color": "Poles", "barcode": "AJ00000002", "qrValue": "AJ00000002", "gemstone": "Berlian", "imageKey": "organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/items/2aab6804-23c0-435b-8b4d-495700a86365/1badbfe9-47f0-4d67-a490-e048406b97f9.webp", "categoryId": "d946ca88-6c6f-4c5b-a0c3-13a30c55ab28", "weightGram": "1.250", "productCode": "RING-AURELIA", "productName": "Aurelia Amethyst Ring", "categoryCode": "RING", "categoryName": "Cincin", "serialNumber": null, "purityPercent": "35.200", "sellingAmount": "1812500", "itemDisplayName": "Aurelia Amethyst Ring", "productImageKey": "organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/products/2fcd87b7-2654-4a9f-a1f7-1f187c34bac7/c97a3275-2e93-4dda-acaa-c3a070de4fe6.webp", "productMasterId": "2fcd87b7-2654-4a9f-a1f7-1f187c34bac7", "masterProductName": "Cincin Solitaire Aurelia", "exchangePurityPercent": "11.000"}	2026-07-22 23:17:50.666+00
00deb869-4f09-4d03-8c1f-2a514cc86b82	baf96a0f-bf66-4fb2-8381-02a0b3e6f33d	3d288805-cfce-40cb-baa7-83ec95d48219	1	2062500	0	2062500	{"sku": "AJ-ITEM-00000004", "size": "12", "color": "Kuning", "barcode": "AJ00000004", "qrValue": "AJ00000004", "gemstone": "Berlian", "imageKey": "organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/items/3d288805-cfce-40cb-baa7-83ec95d48219/238f71b6-d378-42dd-a648-a24eb46b586c.webp", "categoryId": "9cd8892b-39ce-4903-b1ca-fd6c8be89a84", "weightGram": "2.750", "productCode": "WEDDING-BRACELET", "productName": "Gelang Wedding Amara", "categoryCode": "BRACELET", "categoryName": "Gelang", "serialNumber": null, "purityPercent": "18.500", "sellingAmount": "2062500", "itemDisplayName": "Gelang Wedding Amara", "productImageKey": "organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/products/0bdd002c-78a4-41fe-944c-97fe439a7fa6/163f16ea-e45e-4a65-b116-30098a7278ca.webp", "productMasterId": "0bdd002c-78a4-41fe-944c-97fe439a7fa6", "masterProductName": "Gelang Solitaire Aurelia", "exchangePurityPercent": "32.000"}	2026-07-23 08:11:56.008+00
f5cbf040-57b3-4f7d-bbba-7dad41bb28a5	902fd7b7-e2c9-4acb-8b4b-caa515a84592	55106de5-7d80-49ef-924b-602241c445e3	1	1450000	0	1450000	{"sku": "AJ-ITEM-00000001", "size": "10", "color": "Poles", "barcode": "AJ00000001", "qrValue": "AJ00000001", "gemstone": "Tanpa Batu", "imageKey": "organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/items/55106de5-7d80-49ef-924b-602241c445e3/91a868f7-8678-4912-aefc-e7c2e64ee180.webp", "categoryId": "d946ca88-6c6f-4c5b-a0c3-13a30c55ab28", "weightGram": "2.750", "productCode": "RING-AURELIA", "productName": "Aurelia Gold Ring", "categoryCode": "RING", "categoryName": "Cincin", "serialNumber": null, "purityPercent": "35.200", "sellingAmount": "1450000", "itemDisplayName": "Aurelia Gold Ring", "productImageKey": "organizations/3f964ae0-a43e-420b-95db-d5350d8ce754/products/2fcd87b7-2654-4a9f-a1f7-1f187c34bac7/c97a3275-2e93-4dda-acaa-c3a070de4fe6.webp", "productMasterId": "2fcd87b7-2654-4a9f-a1f7-1f187c34bac7", "masterProductName": "Cincin Solitaire Aurelia", "exchangePurityPercent": "11.000"}	2026-07-23 08:13:19.384+00
\.


--
-- Data for Name: sale_return_cases; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.sale_return_cases (id, organization_id, outlet_id, sale_id, approval_id, status, expected_item_count, received_item_count, inspected_item_count, notes, created_by, completed_at, cancelled_at, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sale_return_items; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.sale_return_items (id, organization_id, outlet_id, return_case_id, sale_item_id, product_item_id, status, expected_sku, expected_barcode, expected_serial_number, expected_weight_gram, received_code, actual_weight_gram, identity_confirmed, certificate_complete, packaging_complete, condition_good, decision, inspection_notes, photo_key, received_by, received_at, inspected_by, inspected_at, decided_by, decided_at, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sales; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.sales (id, organization_id, outlet_id, register_id, shift_id, customer_id, cashier_id, invoice_number, idempotency_key, checkout_fingerprint, status, subtotal_amount, discount_amount, discount_reason, additional_fee_amount, total_amount, completed_at, cancelled_at, notes, created_at, updated_at) FROM stdin;
b811bd6a-1e1a-4b1f-b3d3-738564db1116	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	066908eb-8d08-4676-a136-197b9af1a7fc	12a39630-334f-4567-a906-55daa8829c94	da5c8f1c-9d23-4085-ad57-f2d1cbed9fec	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	AJ-TOKO-BG-20260723-8D52349C	pos_3af1013e-3a4f-4e43-9b41-719abcc492e9	fe335f55b9c101bf7f87ddc8fd9bfb900b69e0352f9972dec0af72e1102a45d8	completed	1287000	0	\N	0	1287000	2026-07-22 19:01:12.762+00	\N	\N	2026-07-22 19:01:12.762+00	2026-07-22 19:01:12.762+00
a05177cf-aa7d-4258-8526-fb36c838dc50	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	3d4da573-4f97-4d7d-818d-69d53de29e24	da5c8f1c-9d23-4085-ad57-f2d1cbed9fec	840c182b-642d-438d-b6ee-24f1e56833a3	AJ-TOKO-BG-20260723-755DB604	pos_0b956cf1-10f6-410f-865a-44892f11030a	1edca4cd9a34609d22345da7d182bc7f4913ad2dc7d24c5ec607aac36455a8b7	completed	1812500	0	\N	0	1812500	2026-07-22 23:17:50.666+00	\N	\N	2026-07-22 23:17:50.666+00	2026-07-22 23:17:50.666+00
baf96a0f-bf66-4fb2-8381-02a0b3e6f33d	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	58c24186-e578-4f6b-91d4-5ebbc3bf0b64	da5c8f1c-9d23-4085-ad57-f2d1cbed9fec	840c182b-642d-438d-b6ee-24f1e56833a3	AJ-TOKO-BG-20260723-3219EA91	pos_dfafc2ba-2314-4ae3-8ede-daa9548995ba	3ffebaaa7da91cc4a9aa8c939c9bc80943a1f504db2bc2a7b4d70511d342f539	completed	2062500	0	\N	0	2062500	2026-07-23 08:11:56.008+00	\N	\N	2026-07-23 08:11:56.008+00	2026-07-23 08:11:56.008+00
902fd7b7-e2c9-4acb-8b4b-caa515a84592	3f964ae0-a43e-420b-95db-d5350d8ce754	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	58c24186-e578-4f6b-91d4-5ebbc3bf0b64	da5c8f1c-9d23-4085-ad57-f2d1cbed9fec	840c182b-642d-438d-b6ee-24f1e56833a3	AJ-TOKO-BG-20260723-D2B23D66	pos_db56dd2d-0d35-418f-8b5d-1be726a66a4d	ee2e6ccd84b70e089be86e7d370b3b832361da3fb75559bce7bef1513d232828	completed	1450000	0	\N	0	1450000	2026-07-23 08:13:19.384+00	\N	\N	2026-07-23 08:13:19.384+00	2026-07-23 08:13:19.384+00
\.


--
-- Data for Name: settlement_import_batches; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.settlement_import_batches (id, organization_id, outlet_id, profile_id, uploaded_by, file_name, file_key, file_hash, file_size_bytes, status, delimiter, headers, column_mapping, row_count, valid_row_count, matched_count, applied_count, ambiguous_count, mismatch_count, not_found_count, duplicate_count, ignored_count, failed_count, error_message, started_at, completed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: settlement_import_mappings; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.settlement_import_mappings (id, organization_id, outlet_id, profile_id, delimiter, column_mapping, updated_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: settlement_import_rows; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.settlement_import_rows (id, batch_id, row_number, raw_data, transaction_date, payment_reference, normalized_reference, gross_amount, fee_amount, tax_amount, net_amount, settlement_reference, provider_status, status, matched_payment_id, candidate_payment_ids, match_reason, error_message, review_notes, applied_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: shifts; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.shifts (id, outlet_id, register_id, opened_by, closed_by, status, opening_cash, expected_cash, actual_cash, cash_variance, variance_reason, opened_at, closed_at, created_at, updated_at) FROM stdin;
12a39630-334f-4567-a906-55daa8829c94	6eabe9d2-5b95-46c6-802b-f229e895bc9a	066908eb-8d08-4676-a136-197b9af1a7fc	840c182b-642d-438d-b6ee-24f1e56833a3	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	closed	650000	1937000	1937000	0	\N	2026-07-22 19:00:24.784+00	2026-07-22 19:09:35.838+00	2026-07-22 19:00:24.784946+00	2026-07-22 19:09:35.838+00
3d4da573-4f97-4d7d-818d-69d53de29e24	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	840c182b-642d-438d-b6ee-24f1e56833a3	840c182b-642d-438d-b6ee-24f1e56833a3	closed	500000	2312500	2312500	0	\N	2026-07-22 18:33:44.801+00	2026-07-23 00:08:36.148+00	2026-07-22 18:33:44.803277+00	2026-07-23 00:08:36.148+00
a0af43ba-c501-4f7b-987b-f71ca958c5cb	6eabe9d2-5b95-46c6-802b-f229e895bc9a	066908eb-8d08-4676-a136-197b9af1a7fc	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	840c182b-642d-438d-b6ee-24f1e56833a3	closed	500000	500000	500000	0	\N	2026-07-22 19:11:47.81+00	2026-07-23 00:09:26.5+00	2026-07-22 19:11:47.812136+00	2026-07-23 00:09:26.5+00
58c24186-e578-4f6b-91d4-5ebbc3bf0b64	6eabe9d2-5b95-46c6-802b-f229e895bc9a	36961177-52d1-45e7-ba0c-d1bf785ce2da	840c182b-642d-438d-b6ee-24f1e56833a3	840c182b-642d-438d-b6ee-24f1e56833a3	closed	65000	3727500	3727500	0	\N	2026-07-23 07:46:22.72+00	2026-07-27 21:06:54.634+00	2026-07-23 07:46:22.725157+00	2026-07-27 21:06:54.634+00
\.


--
-- Data for Name: user_outlets; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.user_outlets (id, user_id, outlet_id, is_primary) FROM stdin;
bdee2f90-cece-4e9c-9529-021cb4b53d5a	840c182b-642d-438d-b6ee-24f1e56833a3	6eabe9d2-5b95-46c6-802b-f229e895bc9a	t
cb86fec1-6a5d-4396-ab47-6bb4d386f8f5	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	6eabe9d2-5b95-46c6-802b-f229e895bc9a	t
9272cb8e-1f8c-4448-9baa-0e77a7d879bb	09bf466f-0533-402a-8175-f12c05fbe101	6eabe9d2-5b95-46c6-802b-f229e895bc9a	t
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.user_roles (id, user_id, role_id, assigned_at, assigned_by) FROM stdin;
ffd5f25d-0d6f-4bf8-a407-c7db6775c701	840c182b-642d-438d-b6ee-24f1e56833a3	5f3543a4-ea6c-4967-85d8-65e6e7a40cd0	2026-07-22 18:19:00.892838+00	\N
cf11f88a-c802-42c1-b9f5-c29506a849de	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	c4175cc4-aa06-4364-bee9-66d84cc6f13c	2026-07-22 18:58:35.267382+00	840c182b-642d-438d-b6ee-24f1e56833a3
7dab0684-8744-4703-99b4-71331deed54b	09bf466f-0533-402a-8175-f12c05fbe101	acfcbb18-c1c1-4540-bb72-ffdcdf88f757	2026-07-23 18:36:41.208038+00	840c182b-642d-438d-b6ee-24f1e56833a3
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.user_sessions (id, user_id, token_hash, expires_at, last_seen_at, revoked_at, ip_address, user_agent, created_at, updated_at) FROM stdin;
cce7d490-5d0d-4da3-a8b8-384c9e6d6038	840c182b-642d-438d-b6ee-24f1e56833a3	6aa6ad600c6cfea21ad245e4205bec885c4d56d040de724c988ae65320448e7d	2026-07-23 06:24:36.519+00	2026-07-22 18:24:36.519+00	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-07-22 18:24:36.525031+00	2026-07-22 18:24:36.525031+00
c26da452-3bea-442f-8965-7c4b1da865a6	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	24f7d87d58cc5d0ddca8608449f9aee4e2a707a0658e8499c3434576f2f4d3ce	2026-07-23 07:00:01.207+00	2026-07-22 19:00:01.207+00	2026-07-22 19:07:51.357+00	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	2026-07-22 19:00:01.209369+00	2026-07-22 19:07:51.357+00
e67e9de0-84f8-416f-ab94-e49e301548fc	840c182b-642d-438d-b6ee-24f1e56833a3	279e0a3d94b15de210aa90e2e2b818a47536a248c28879810376da331bea2551	2026-07-23 07:07:53.096+00	2026-07-22 19:07:53.096+00	2026-07-22 19:08:04.785+00	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	2026-07-22 19:07:53.098018+00	2026-07-22 19:08:04.785+00
1fa21278-3e30-4486-a52b-a59f00c43690	1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	9166f182b43033143664995d5e9e18abe873f3491a153e3dccab1f62898e3e2e	2026-07-23 07:08:09.798+00	2026-07-22 19:08:09.798+00	\N	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0	2026-07-22 19:08:09.800203+00	2026-07-22 19:08:09.800203+00
fc132e52-3def-4034-8757-9e02915526bf	840c182b-642d-438d-b6ee-24f1e56833a3	22cf6247f93c9cfb703691c44777606ec3571ee24589e8c8a0337b71be83f3e2	2026-07-23 19:33:21.006+00	2026-07-23 07:33:21.007+00	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	2026-07-23 07:33:21.009394+00	2026-07-23 07:33:21.009394+00
a540cb5c-1aa7-4f64-b150-99d3380af372	09bf466f-0533-402a-8175-f12c05fbe101	eacb5577327d4b8610a3a08507693a3b23a166bc9d4775ddac4d93939a5845fc	2026-07-24 06:37:18.011+00	2026-07-23 18:37:18.011+00	2026-07-23 18:45:20.8+00	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0	2026-07-23 18:37:18.012697+00	2026-07-23 18:45:20.8+00
70dc8029-3353-4e28-bec5-34d7067adb5c	840c182b-642d-438d-b6ee-24f1e56833a3	d2e208fe4fca119758970b212cff22543f78f497e3376fe7c2cb5bf135626fef	2026-07-24 11:26:08.185+00	2026-07-23 23:26:08.185+00	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	2026-07-23 23:26:08.188712+00	2026-07-23 23:26:08.188712+00
e1dfdaea-0f17-4bc0-9f71-e747490d2e3c	840c182b-642d-438d-b6ee-24f1e56833a3	e2374b8f4620c07373c44c86440cf767badf76690fad88fba3c1ec741e90e502	2026-07-25 19:03:05.662+00	2026-07-25 07:03:05.662+00	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	2026-07-25 07:03:05.668422+00	2026-07-25 07:03:05.668422+00
5f9cc9d2-0938-43cb-a632-36e745df6031	840c182b-642d-438d-b6ee-24f1e56833a3	ade81826827d32f3d37273628bec344ae3cbc45588219e759da8da766e7197a8	2026-07-26 07:06:50.987+00	2026-07-25 19:06:50.987+00	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	2026-07-25 19:06:50.988707+00	2026-07-25 19:06:50.988707+00
72394d12-289c-4803-8983-424af6e07687	840c182b-642d-438d-b6ee-24f1e56833a3	e0b0cbf69cf09df6bf8a38faa80da27074236149d2d7d1dfbf886e35d47c84f2	2026-07-26 20:28:12.346+00	2026-07-26 08:28:12.346+00	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	2026-07-26 08:28:12.3472+00	2026-07-26 08:28:12.3472+00
d0f09c20-d874-4924-951d-91de88954617	840c182b-642d-438d-b6ee-24f1e56833a3	3d3703dfb2ed18dacf56e9fceb4f6cfe3dfdc6969ff1194c94feddea4d551024	2026-07-27 18:17:24.1+00	2026-07-27 06:17:24.1+00	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	2026-07-27 06:17:24.107035+00	2026-07-27 06:17:24.107035+00
08aa1454-625e-493e-83cf-9f948cfcb72a	840c182b-642d-438d-b6ee-24f1e56833a3	6a374ca8d2a38f4326b19fc0db2fcbe4a1fbdf51fb10b977dc5b2d49fe4cddeb	2026-07-28 09:06:32.82+00	2026-07-27 21:06:32.82+00	2026-07-27 21:07:31.887+00	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	2026-07-27 21:06:32.821901+00	2026-07-27 21:07:31.887+00
bad91724-6c22-45ac-9fb6-34ab494e4233	840c182b-642d-438d-b6ee-24f1e56833a3	6765bc9fcd2b4dc9c04f1d6563ae0d4eba54847f04ccf51070f07b501c0f303b	2026-07-28 09:15:29.658+00	2026-07-27 21:15:29.658+00	2026-07-27 21:22:22.061+00	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	2026-07-27 21:15:29.660266+00	2026-07-27 21:22:22.061+00
2ee86507-11c4-430d-be80-bdfe29893e61	840c182b-642d-438d-b6ee-24f1e56833a3	193a378129a25fa2c71ebda825f48a402b87bf6624f2d050ffbab95ed3e9fd2f	2026-07-28 09:22:27.675+00	2026-07-27 21:22:27.675+00	2026-07-27 21:36:05.229+00	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	2026-07-27 21:22:27.676791+00	2026-07-27 21:36:05.229+00
2dc93e53-ef66-4332-bc33-aea1bac48414	840c182b-642d-438d-b6ee-24f1e56833a3	4d1b283da201848dedc35e5e1abd096014195a9b2bfbe8b22715119db54efa5d	2026-07-28 09:36:06.913+00	2026-07-27 21:36:06.913+00	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	2026-07-27 21:36:06.915191+00	2026-07-27 21:36:06.915191+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: asihjaya
--

COPY public.users (id, organization_id, email, username, full_name, phone, password_hash, status, last_login_at, created_at, updated_at) FROM stdin;
1e2b1d29-e48c-43a6-b7ab-8fa0761f2524	3f964ae0-a43e-420b-95db-d5350d8ce754	anindita@asihjaya.local	anindita	Anindita Silva	081234567891	scrypt$32768$8$3$YNHkCzgwE0_7_N8JNwIqVg$7MhkreqmfGGvlc91_BzyjBvDbb-6zQv-s5id3RW_K4T2GfFMn18JZMMyKNnyF5aHz1At_njOLD6H_zzyroofMg	active	2026-07-22 19:08:09.791+00	2026-07-22 18:58:35.267382+00	2026-07-22 19:08:09.791+00
09bf466f-0533-402a-8175-f12c05fbe101	3f964ae0-a43e-420b-95db-d5350d8ce754	eramistik@asihjaya.local	eramistik	Era Mistik	081234567891	scrypt$32768$8$3$LRNoFNh5A9MvFtcDvTym-g$6aKd_tqMQu6fX6hrugizBVZdayxVz5PwrerisNQ9EbT2JBy9IcU8logn5gk3wNFjfQP_RlEZNUHBOgYC3BkM6Q	active	2026-07-23 18:37:18.003+00	2026-07-23 18:36:41.208038+00	2026-07-23 18:37:18.003+00
840c182b-642d-438d-b6ee-24f1e56833a3	3f964ae0-a43e-420b-95db-d5350d8ce754	admin@asihjaya.local	admin	System Administrator	\N	scrypt$32768$8$3$8Y4pa7sAgvX_BfVDY3JLnw$PLbyR7T03nvv7Qu-3vpRNPnB33FZZrFnJ-2O-hk2phfvVjk0_EVsbI0p0edzDNUqnp3VU4mkxgu3l8NUsp_paQ	active	2026-07-27 21:36:06.906+00	2026-07-22 18:19:00.892838+00	2026-07-27 21:36:06.906+00
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: asihjaya
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 3, true);


--
-- Name: product_item_number_seq; Type: SEQUENCE SET; Schema: public; Owner: asihjaya
--

SELECT pg_catalog.setval('public.product_item_number_seq', 5, true);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: asihjaya
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: cash_movements cash_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_pkey PRIMARY KEY (id);


--
-- Name: customer_deposit_ledger customer_deposit_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_deposit_ledger
    ADD CONSTRAINT customer_deposit_ledger_pkey PRIMARY KEY (id);


--
-- Name: customer_history_credentials customer_history_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_history_credentials
    ADD CONSTRAINT customer_history_credentials_pkey PRIMARY KEY (id);


--
-- Name: customer_history_ip_rate_limits customer_history_ip_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_history_ip_rate_limits
    ADD CONSTRAINT customer_history_ip_rate_limits_pkey PRIMARY KEY (id);


--
-- Name: customer_history_sessions customer_history_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_history_sessions
    ADD CONSTRAINT customer_history_sessions_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: hardware_agents hardware_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_agents
    ADD CONSTRAINT hardware_agents_pkey PRIMARY KEY (id);


--
-- Name: hardware_job_attempts hardware_job_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_job_attempts
    ADD CONSTRAINT hardware_job_attempts_pkey PRIMARY KEY (id);


--
-- Name: hardware_job_resolutions hardware_job_resolutions_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_job_resolutions
    ADD CONSTRAINT hardware_job_resolutions_pkey PRIMARY KEY (id);


--
-- Name: hardware_jobs hardware_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_jobs
    ADD CONSTRAINT hardware_jobs_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: manual_payment_policies manual_payment_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.manual_payment_policies
    ADD CONSTRAINT manual_payment_policies_pkey PRIMARY KEY (id);


--
-- Name: manual_payment_profiles manual_payment_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.manual_payment_profiles
    ADD CONSTRAINT manual_payment_profiles_pkey PRIMARY KEY (id);


--
-- Name: metal_price_rates metal_price_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.metal_price_rates
    ADD CONSTRAINT metal_price_rates_pkey PRIMARY KEY (id);


--
-- Name: metal_purities metal_purities_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.metal_purities
    ADD CONSTRAINT metal_purities_pkey PRIMARY KEY (id);


--
-- Name: metals metals_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.metals
    ADD CONSTRAINT metals_pkey PRIMARY KEY (id);


--
-- Name: notification_events notification_events_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.notification_events
    ADD CONSTRAINT notification_events_pkey PRIMARY KEY (id);


--
-- Name: notification_recipients notification_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.notification_recipients
    ADD CONSTRAINT notification_recipients_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: outlets outlets_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.outlets
    ADD CONSTRAINT outlets_pkey PRIMARY KEY (id);


--
-- Name: payment_evidence_uploads payment_evidence_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_evidence_uploads
    ADD CONSTRAINT payment_evidence_uploads_pkey PRIMARY KEY (id);


--
-- Name: payment_reconciliations payment_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_reconciliations
    ADD CONSTRAINT payment_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: payment_refunds payment_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: pos_checkout_attempts pos_checkout_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_checkout_attempts
    ADD CONSTRAINT pos_checkout_attempts_pkey PRIMARY KEY (id);


--
-- Name: pos_held_cart_items pos_held_cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_held_cart_items
    ADD CONSTRAINT pos_held_cart_items_pkey PRIMARY KEY (id);


--
-- Name: pos_held_carts pos_held_carts_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_held_carts
    ADD CONSTRAINT pos_held_carts_pkey PRIMARY KEY (id);


--
-- Name: product_categories product_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_pkey PRIMARY KEY (id);


--
-- Name: product_items product_items_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.product_items
    ADD CONSTRAINT product_items_pkey PRIMARY KEY (id);


--
-- Name: product_masters product_masters_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.product_masters
    ADD CONSTRAINT product_masters_pkey PRIMARY KEY (id);


--
-- Name: registers registers_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.registers
    ADD CONSTRAINT registers_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sale_return_cases sale_return_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_return_cases
    ADD CONSTRAINT sale_return_cases_pkey PRIMARY KEY (id);


--
-- Name: sale_return_items sale_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_return_items
    ADD CONSTRAINT sale_return_items_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: settlement_import_batches settlement_import_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.settlement_import_batches
    ADD CONSTRAINT settlement_import_batches_pkey PRIMARY KEY (id);


--
-- Name: settlement_import_mappings settlement_import_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.settlement_import_mappings
    ADD CONSTRAINT settlement_import_mappings_pkey PRIMARY KEY (id);


--
-- Name: settlement_import_rows settlement_import_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.settlement_import_rows
    ADD CONSTRAINT settlement_import_rows_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: user_outlets user_outlets_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.user_outlets
    ADD CONSTRAINT user_outlets_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: approvals_execution_idempotency_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX approvals_execution_idempotency_uq ON public.approvals USING btree (organization_id, execution_idempotency_key) WHERE (execution_idempotency_key IS NOT NULL);


--
-- Name: approvals_execution_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX approvals_execution_status_idx ON public.approvals USING btree (organization_id, execution_status);


--
-- Name: approvals_manual_payment_fingerprint_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX approvals_manual_payment_fingerprint_uq ON public.approvals USING btree (organization_id, outlet_id, requested_by, ((request_data ->> 'verificationFingerprint'::text))) WHERE (type = 'manual_payment_verification'::public.approval_type);


--
-- Name: approvals_org_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX approvals_org_status_idx ON public.approvals USING btree (organization_id, status);


--
-- Name: approvals_ref_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX approvals_ref_idx ON public.approvals USING btree (reference_type, reference_id);


--
-- Name: audit_logs_entity_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX audit_logs_entity_idx ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: audit_logs_org_time_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX audit_logs_org_time_idx ON public.audit_logs USING btree (organization_id, created_at);


--
-- Name: cash_movements_reference_guard_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX cash_movements_reference_guard_uq ON public.cash_movements USING btree (type, reference_type, reference_id) WHERE ((reference_type IS NOT NULL) AND (reference_id IS NOT NULL));


--
-- Name: cash_movements_shift_time_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX cash_movements_shift_time_idx ON public.cash_movements USING btree (shift_id, created_at);


--
-- Name: customer_deposit_ledger_idempotency_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX customer_deposit_ledger_idempotency_uq ON public.customer_deposit_ledger USING btree (organization_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: customer_deposit_ledger_reference_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX customer_deposit_ledger_reference_idx ON public.customer_deposit_ledger USING btree (reference_type, reference_id);


--
-- Name: customer_deposit_ledger_sale_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX customer_deposit_ledger_sale_idx ON public.customer_deposit_ledger USING btree (sale_id);


--
-- Name: customer_deposit_ledger_scope_time_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX customer_deposit_ledger_scope_time_idx ON public.customer_deposit_ledger USING btree (organization_id, outlet_id, customer_id, occurred_at);


--
-- Name: customer_history_credentials_customer_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX customer_history_credentials_customer_uq ON public.customer_history_credentials USING btree (customer_id);


--
-- Name: customer_history_credentials_org_active_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX customer_history_credentials_org_active_idx ON public.customer_history_credentials USING btree (organization_id, is_active);


--
-- Name: customer_history_ip_rate_limits_blocked_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX customer_history_ip_rate_limits_blocked_idx ON public.customer_history_ip_rate_limits USING btree (blocked_until);


--
-- Name: customer_history_ip_rate_limits_key_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX customer_history_ip_rate_limits_key_uq ON public.customer_history_ip_rate_limits USING btree (key_hash);


--
-- Name: customer_history_sessions_customer_expiry_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX customer_history_sessions_customer_expiry_idx ON public.customer_history_sessions USING btree (customer_id, absolute_expires_at);


--
-- Name: customer_history_sessions_expiry_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX customer_history_sessions_expiry_idx ON public.customer_history_sessions USING btree (absolute_expires_at, idle_expires_at);


--
-- Name: customer_history_sessions_token_hash_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX customer_history_sessions_token_hash_uq ON public.customer_history_sessions USING btree (token_hash);


--
-- Name: customers_org_code_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX customers_org_code_uq ON public.customers USING btree (organization_id, customer_code);


--
-- Name: customers_org_phone_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX customers_org_phone_idx ON public.customers USING btree (organization_id, phone);


--
-- Name: hardware_agents_org_code_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX hardware_agents_org_code_uq ON public.hardware_agents USING btree (organization_id, code);


--
-- Name: hardware_agents_org_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX hardware_agents_org_status_idx ON public.hardware_agents USING btree (organization_id, status);


--
-- Name: hardware_agents_register_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX hardware_agents_register_idx ON public.hardware_agents USING btree (register_id, is_active);


--
-- Name: hardware_job_attempts_agent_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX hardware_job_attempts_agent_status_idx ON public.hardware_job_attempts USING btree (agent_id, status, created_at);


--
-- Name: hardware_job_attempts_job_number_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX hardware_job_attempts_job_number_uq ON public.hardware_job_attempts USING btree (job_id, attempt_number);


--
-- Name: hardware_job_attempts_lease_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX hardware_job_attempts_lease_idx ON public.hardware_job_attempts USING btree (status, lease_expires_at);


--
-- Name: hardware_job_attempts_one_active_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX hardware_job_attempts_one_active_uq ON public.hardware_job_attempts USING btree (job_id) WHERE (status = ANY (ARRAY['claimed'::public.hardware_job_attempt_status, 'processing'::public.hardware_job_attempt_status, 'dispatching'::public.hardware_job_attempt_status, 'submitted'::public.hardware_job_attempt_status]));


--
-- Name: hardware_job_resolutions_job_time_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX hardware_job_resolutions_job_time_idx ON public.hardware_job_resolutions USING btree (job_id, created_at);


--
-- Name: hardware_job_resolutions_org_time_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX hardware_job_resolutions_org_time_idx ON public.hardware_job_resolutions USING btree (organization_id, created_at);


--
-- Name: hardware_jobs_agent_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX hardware_jobs_agent_status_idx ON public.hardware_jobs USING btree (agent_id, status);


--
-- Name: hardware_jobs_claim_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX hardware_jobs_claim_idx ON public.hardware_jobs USING btree (organization_id, outlet_id, register_id, status, available_at);


--
-- Name: hardware_jobs_current_attempt_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX hardware_jobs_current_attempt_uq ON public.hardware_jobs USING btree (current_attempt_id) WHERE (current_attempt_id IS NOT NULL);


--
-- Name: hardware_jobs_expiry_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX hardware_jobs_expiry_idx ON public.hardware_jobs USING btree (status, expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: hardware_jobs_idempotency_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX hardware_jobs_idempotency_uq ON public.hardware_jobs USING btree (organization_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: hardware_jobs_source_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX hardware_jobs_source_idx ON public.hardware_jobs USING btree (source_type, source_id);


--
-- Name: hardware_jobs_target_agent_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX hardware_jobs_target_agent_idx ON public.hardware_jobs USING btree (target_agent_id, status, available_at);


--
-- Name: hardware_jobs_v2_claim_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX hardware_jobs_v2_claim_idx ON public.hardware_jobs USING btree (organization_id, outlet_id, register_id, protocol_version, status, required_capability, available_at, priority);


--
-- Name: inventory_movements_item_time_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX inventory_movements_item_time_idx ON public.inventory_movements USING btree (item_id, occurred_at);


--
-- Name: inventory_movements_reference_guard_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX inventory_movements_reference_guard_uq ON public.inventory_movements USING btree (item_id, movement_type, reference_type, reference_id) WHERE ((reference_type IS NOT NULL) AND (reference_id IS NOT NULL));


--
-- Name: inventory_movements_reference_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX inventory_movements_reference_idx ON public.inventory_movements USING btree (reference_type, reference_id);


--
-- Name: manual_payment_policies_org_method_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX manual_payment_policies_org_method_uq ON public.manual_payment_policies USING btree (organization_id, method);


--
-- Name: manual_payment_profiles_org_outlet_code_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX manual_payment_profiles_org_outlet_code_uq ON public.manual_payment_profiles USING btree (organization_id, outlet_id, code);


--
-- Name: manual_payment_profiles_outlet_type_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX manual_payment_profiles_outlet_type_idx ON public.manual_payment_profiles USING btree (outlet_id, profile_type, is_active, display_order);


--
-- Name: manual_payment_profiles_register_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX manual_payment_profiles_register_idx ON public.manual_payment_profiles USING btree (register_id, is_active);


--
-- Name: metal_price_rates_purity_effective_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX metal_price_rates_purity_effective_uq ON public.metal_price_rates USING btree (metal_purity_id, effective_from);


--
-- Name: metal_purities_metal_active_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX metal_purities_metal_active_idx ON public.metal_purities USING btree (metal_id, is_active);


--
-- Name: metal_purities_metal_code_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX metal_purities_metal_code_uq ON public.metal_purities USING btree (metal_id, code);


--
-- Name: metals_org_active_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX metals_org_active_idx ON public.metals USING btree (organization_id, is_active);


--
-- Name: metals_org_code_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX metals_org_code_uq ON public.metals USING btree (organization_id, code);


--
-- Name: notification_events_active_action_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX notification_events_active_action_idx ON public.notification_events USING btree (organization_id, requires_action, severity) WHERE (resolved_at IS NULL);


--
-- Name: notification_events_active_dedupe_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX notification_events_active_dedupe_uq ON public.notification_events USING btree (organization_id, deduplication_key) WHERE ((deduplication_key IS NOT NULL) AND (resolved_at IS NULL));


--
-- Name: notification_events_entity_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX notification_events_entity_idx ON public.notification_events USING btree (entity_type, entity_id);


--
-- Name: notification_events_org_category_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX notification_events_org_category_idx ON public.notification_events USING btree (organization_id, category, occurred_at);


--
-- Name: notification_events_org_occurred_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX notification_events_org_occurred_idx ON public.notification_events USING btree (organization_id, occurred_at);


--
-- Name: notification_events_outlet_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX notification_events_outlet_idx ON public.notification_events USING btree (outlet_id, occurred_at);


--
-- Name: notification_recipients_event_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX notification_recipients_event_status_idx ON public.notification_recipients USING btree (event_id, status);


--
-- Name: notification_recipients_event_user_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX notification_recipients_event_user_uq ON public.notification_recipients USING btree (event_id, user_id);


--
-- Name: notification_recipients_user_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX notification_recipients_user_status_idx ON public.notification_recipients USING btree (user_id, status, created_at);


--
-- Name: notifications_entity_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX notifications_entity_idx ON public.notifications USING btree (entity_type, entity_id);


--
-- Name: notifications_org_type_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX notifications_org_type_idx ON public.notifications USING btree (organization_id, type);


--
-- Name: notifications_org_unread_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX notifications_org_unread_idx ON public.notifications USING btree (organization_id, is_read, created_at);


--
-- Name: notifications_outlet_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX notifications_outlet_idx ON public.notifications USING btree (outlet_id, created_at);


--
-- Name: notifications_user_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, is_read);


--
-- Name: organizations_slug_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX organizations_slug_uq ON public.organizations USING btree (slug);


--
-- Name: outlets_org_code_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX outlets_org_code_uq ON public.outlets USING btree (organization_id, code);


--
-- Name: outlets_org_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX outlets_org_idx ON public.outlets USING btree (organization_id);


--
-- Name: payment_evidence_uploads_expiry_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX payment_evidence_uploads_expiry_idx ON public.payment_evidence_uploads USING btree (sale_id, expires_at);


--
-- Name: payment_evidence_uploads_org_outlet_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX payment_evidence_uploads_org_outlet_idx ON public.payment_evidence_uploads USING btree (organization_id, outlet_id, created_at);


--
-- Name: payment_evidence_uploads_storage_key_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX payment_evidence_uploads_storage_key_uq ON public.payment_evidence_uploads USING btree (storage_key);


--
-- Name: payment_evidence_uploads_uploader_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX payment_evidence_uploads_uploader_idx ON public.payment_evidence_uploads USING btree (uploaded_by, created_at);


--
-- Name: payment_reconciliations_org_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX payment_reconciliations_org_status_idx ON public.payment_reconciliations USING btree (organization_id, status, updated_at);


--
-- Name: payment_reconciliations_outlet_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX payment_reconciliations_outlet_status_idx ON public.payment_reconciliations USING btree (outlet_id, status, updated_at);


--
-- Name: payment_reconciliations_payment_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX payment_reconciliations_payment_uq ON public.payment_reconciliations USING btree (payment_id);


--
-- Name: payment_reconciliations_settlement_date_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX payment_reconciliations_settlement_date_idx ON public.payment_reconciliations USING btree (settlement_date);


--
-- Name: payment_refunds_approval_payment_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX payment_refunds_approval_payment_uq ON public.payment_refunds USING btree (approval_id, payment_id) WHERE (approval_id IS NOT NULL);


--
-- Name: payment_refunds_org_idempotency_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX payment_refunds_org_idempotency_uq ON public.payment_refunds USING btree (organization_id, idempotency_key);


--
-- Name: payment_refunds_payment_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX payment_refunds_payment_status_idx ON public.payment_refunds USING btree (payment_id, status);


--
-- Name: payment_refunds_provider_reference_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX payment_refunds_provider_reference_idx ON public.payment_refunds USING btree (provider, provider_reference);


--
-- Name: payment_refunds_refund_shift_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX payment_refunds_refund_shift_idx ON public.payment_refunds USING btree (refund_shift_id);


--
-- Name: payment_refunds_sale_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX payment_refunds_sale_status_idx ON public.payment_refunds USING btree (sale_id, status);


--
-- Name: payments_manual_profile_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX payments_manual_profile_idx ON public.payments USING btree (manual_payment_profile_id, created_at);


--
-- Name: payments_normalized_reference_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX payments_normalized_reference_idx ON public.payments USING btree (method, provider, normalized_reference);


--
-- Name: payments_provider_reference_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX payments_provider_reference_idx ON public.payments USING btree (provider, provider_reference);


--
-- Name: payments_sale_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX payments_sale_status_idx ON public.payments USING btree (sale_id, status);


--
-- Name: payments_settlement_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX payments_settlement_status_idx ON public.payments USING btree (settlement_status, created_at);


--
-- Name: payments_verification_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX payments_verification_status_idx ON public.payments USING btree (verification_status, created_at);


--
-- Name: permissions_code_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX permissions_code_uq ON public.permissions USING btree (code);


--
-- Name: pos_checkout_attempts_idempotency_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX pos_checkout_attempts_idempotency_uq ON public.pos_checkout_attempts USING btree (idempotency_key);


--
-- Name: pos_checkout_attempts_org_cashier_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX pos_checkout_attempts_org_cashier_idx ON public.pos_checkout_attempts USING btree (organization_id, cashier_id, created_at);


--
-- Name: pos_checkout_attempts_sale_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX pos_checkout_attempts_sale_idx ON public.pos_checkout_attempts USING btree (sale_id);


--
-- Name: pos_held_cart_items_active_item_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX pos_held_cart_items_active_item_uq ON public.pos_held_cart_items USING btree (product_item_id) WHERE (is_active = true);


--
-- Name: pos_held_cart_items_cart_active_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX pos_held_cart_items_cart_active_idx ON public.pos_held_cart_items USING btree (held_cart_id, is_active);


--
-- Name: pos_held_cart_items_cart_item_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX pos_held_cart_items_cart_item_uq ON public.pos_held_cart_items USING btree (held_cart_id, product_item_id);


--
-- Name: pos_held_cart_items_cart_line_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX pos_held_cart_items_cart_line_uq ON public.pos_held_cart_items USING btree (held_cart_id, line_number);


--
-- Name: pos_held_cart_items_product_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX pos_held_cart_items_product_idx ON public.pos_held_cart_items USING btree (product_item_id);


--
-- Name: pos_held_carts_customer_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX pos_held_carts_customer_idx ON public.pos_held_carts USING btree (customer_id);


--
-- Name: pos_held_carts_held_by_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX pos_held_carts_held_by_idx ON public.pos_held_carts USING btree (held_by_user_id);


--
-- Name: pos_held_carts_org_hold_number_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX pos_held_carts_org_hold_number_uq ON public.pos_held_carts USING btree (organization_id, hold_number);


--
-- Name: pos_held_carts_outlet_status_created_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX pos_held_carts_outlet_status_created_idx ON public.pos_held_carts USING btree (outlet_id, status, created_at);


--
-- Name: pos_held_carts_register_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX pos_held_carts_register_status_idx ON public.pos_held_carts USING btree (register_id, status);


--
-- Name: pos_held_carts_shift_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX pos_held_carts_shift_status_idx ON public.pos_held_carts USING btree (shift_id, status);


--
-- Name: product_categories_org_active_order_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX product_categories_org_active_order_idx ON public.product_categories USING btree (organization_id, is_active, display_order);


--
-- Name: product_categories_org_code_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX product_categories_org_code_uq ON public.product_categories USING btree (organization_id, code);


--
-- Name: product_categories_org_parent_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX product_categories_org_parent_idx ON public.product_categories USING btree (organization_id, parent_category_id);


--
-- Name: product_items_master_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX product_items_master_idx ON public.product_items USING btree (product_master_id);


--
-- Name: product_items_org_barcode_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX product_items_org_barcode_uq ON public.product_items USING btree (organization_id, barcode);


--
-- Name: product_items_org_serial_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX product_items_org_serial_uq ON public.product_items USING btree (organization_id, serial_number);


--
-- Name: product_items_org_sku_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX product_items_org_sku_uq ON public.product_items USING btree (organization_id, sku);


--
-- Name: product_items_outlet_availability_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX product_items_outlet_availability_idx ON public.product_items USING btree (current_outlet_id, availability);


--
-- Name: product_masters_category_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX product_masters_category_idx ON public.product_masters USING btree (category_id);


--
-- Name: product_masters_org_code_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX product_masters_org_code_uq ON public.product_masters USING btree (organization_id, code);


--
-- Name: product_masters_org_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX product_masters_org_status_idx ON public.product_masters USING btree (organization_id, status);


--
-- Name: registers_one_hardware_hub_per_outlet_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX registers_one_hardware_hub_per_outlet_uq ON public.registers USING btree (outlet_id) WHERE (is_hardware_hub = true);


--
-- Name: registers_outlet_code_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX registers_outlet_code_uq ON public.registers USING btree (outlet_id, code);


--
-- Name: registers_outlet_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX registers_outlet_idx ON public.registers USING btree (outlet_id);


--
-- Name: role_permissions_role_permission_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX role_permissions_role_permission_uq ON public.role_permissions USING btree (role_id, permission_id);


--
-- Name: roles_org_code_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX roles_org_code_uq ON public.roles USING btree (organization_id, code);


--
-- Name: sale_items_sale_item_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX sale_items_sale_item_uq ON public.sale_items USING btree (sale_id, product_item_id);


--
-- Name: sale_items_sale_line_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX sale_items_sale_line_uq ON public.sale_items USING btree (sale_id, line_number);


--
-- Name: sale_return_cases_approval_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX sale_return_cases_approval_uq ON public.sale_return_cases USING btree (approval_id) WHERE (approval_id IS NOT NULL);


--
-- Name: sale_return_cases_outlet_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX sale_return_cases_outlet_status_idx ON public.sale_return_cases USING btree (outlet_id, status);


--
-- Name: sale_return_cases_sale_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX sale_return_cases_sale_uq ON public.sale_return_cases USING btree (sale_id);


--
-- Name: sale_return_items_case_product_item_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX sale_return_items_case_product_item_uq ON public.sale_return_items USING btree (return_case_id, product_item_id);


--
-- Name: sale_return_items_case_sale_item_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX sale_return_items_case_sale_item_uq ON public.sale_return_items USING btree (return_case_id, sale_item_id);


--
-- Name: sale_return_items_case_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX sale_return_items_case_status_idx ON public.sale_return_items USING btree (return_case_id, status);


--
-- Name: sale_return_items_product_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX sale_return_items_product_status_idx ON public.sale_return_items USING btree (product_item_id, status);


--
-- Name: sales_idempotency_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX sales_idempotency_uq ON public.sales USING btree (idempotency_key);


--
-- Name: sales_org_invoice_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX sales_org_invoice_uq ON public.sales USING btree (organization_id, invoice_number);


--
-- Name: sales_outlet_created_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX sales_outlet_created_idx ON public.sales USING btree (outlet_id, created_at);


--
-- Name: sales_shift_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX sales_shift_idx ON public.sales USING btree (shift_id);


--
-- Name: settlement_import_batches_org_hash_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX settlement_import_batches_org_hash_uq ON public.settlement_import_batches USING btree (organization_id, file_hash);


--
-- Name: settlement_import_batches_org_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX settlement_import_batches_org_status_idx ON public.settlement_import_batches USING btree (organization_id, status, created_at);


--
-- Name: settlement_import_batches_outlet_profile_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX settlement_import_batches_outlet_profile_idx ON public.settlement_import_batches USING btree (outlet_id, profile_id, created_at);


--
-- Name: settlement_import_mappings_org_outlet_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX settlement_import_mappings_org_outlet_idx ON public.settlement_import_mappings USING btree (organization_id, outlet_id);


--
-- Name: settlement_import_mappings_profile_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX settlement_import_mappings_profile_uq ON public.settlement_import_mappings USING btree (profile_id);


--
-- Name: settlement_import_rows_batch_row_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX settlement_import_rows_batch_row_uq ON public.settlement_import_rows USING btree (batch_id, row_number);


--
-- Name: settlement_import_rows_batch_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX settlement_import_rows_batch_status_idx ON public.settlement_import_rows USING btree (batch_id, status, row_number);


--
-- Name: settlement_import_rows_payment_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX settlement_import_rows_payment_idx ON public.settlement_import_rows USING btree (matched_payment_id);


--
-- Name: settlement_import_rows_reference_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX settlement_import_rows_reference_idx ON public.settlement_import_rows USING btree (normalized_reference);


--
-- Name: shifts_one_active_per_register_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX shifts_one_active_per_register_uq ON public.shifts USING btree (register_id) WHERE (status = ANY (ARRAY['open'::public.shift_status, 'closing'::public.shift_status]));


--
-- Name: shifts_outlet_opened_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX shifts_outlet_opened_idx ON public.shifts USING btree (outlet_id, opened_at);


--
-- Name: shifts_register_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX shifts_register_status_idx ON public.shifts USING btree (register_id, status);


--
-- Name: user_outlets_user_outlet_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX user_outlets_user_outlet_uq ON public.user_outlets USING btree (user_id, outlet_id);


--
-- Name: user_roles_user_role_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX user_roles_user_role_uq ON public.user_roles USING btree (user_id, role_id);


--
-- Name: user_sessions_expires_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX user_sessions_expires_idx ON public.user_sessions USING btree (expires_at);


--
-- Name: user_sessions_token_hash_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX user_sessions_token_hash_uq ON public.user_sessions USING btree (token_hash);


--
-- Name: user_sessions_user_expires_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX user_sessions_user_expires_idx ON public.user_sessions USING btree (user_id, expires_at);


--
-- Name: users_org_email_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX users_org_email_uq ON public.users USING btree (organization_id, email);


--
-- Name: users_org_status_idx; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE INDEX users_org_status_idx ON public.users USING btree (organization_id, status);


--
-- Name: users_org_username_uq; Type: INDEX; Schema: public; Owner: asihjaya
--

CREATE UNIQUE INDEX users_org_username_uq ON public.users USING btree (organization_id, username);


--
-- Name: approvals approvals_approved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_approved_by_users_id_fk FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: approvals approvals_executed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_executed_by_users_id_fk FOREIGN KEY (executed_by) REFERENCES public.users(id);


--
-- Name: approvals approvals_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: approvals approvals_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: approvals approvals_requested_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_requested_by_users_id_fk FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: audit_logs audit_logs_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id);


--
-- Name: audit_logs audit_logs_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: audit_logs audit_logs_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: cash_movements cash_movements_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: cash_movements cash_movements_shift_id_shifts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_shift_id_shifts_id_fk FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: customer_deposit_ledger customer_deposit_ledger_approval_id_approvals_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_deposit_ledger
    ADD CONSTRAINT customer_deposit_ledger_approval_id_approvals_id_fk FOREIGN KEY (approval_id) REFERENCES public.approvals(id) ON DELETE SET NULL;


--
-- Name: customer_deposit_ledger customer_deposit_ledger_cash_movement_id_cash_movements_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_deposit_ledger
    ADD CONSTRAINT customer_deposit_ledger_cash_movement_id_cash_movements_id_fk FOREIGN KEY (cash_movement_id) REFERENCES public.cash_movements(id) ON DELETE SET NULL;


--
-- Name: customer_deposit_ledger customer_deposit_ledger_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_deposit_ledger
    ADD CONSTRAINT customer_deposit_ledger_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: customer_deposit_ledger customer_deposit_ledger_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_deposit_ledger
    ADD CONSTRAINT customer_deposit_ledger_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_deposit_ledger customer_deposit_ledger_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_deposit_ledger
    ADD CONSTRAINT customer_deposit_ledger_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: customer_deposit_ledger customer_deposit_ledger_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_deposit_ledger
    ADD CONSTRAINT customer_deposit_ledger_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: customer_deposit_ledger customer_deposit_ledger_payment_id_payments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_deposit_ledger
    ADD CONSTRAINT customer_deposit_ledger_payment_id_payments_id_fk FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: customer_deposit_ledger customer_deposit_ledger_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_deposit_ledger
    ADD CONSTRAINT customer_deposit_ledger_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


--
-- Name: customer_history_credentials customer_history_credentials_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_history_credentials
    ADD CONSTRAINT customer_history_credentials_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_history_credentials customer_history_credentials_organization_id_organizations_id_f; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_history_credentials
    ADD CONSTRAINT customer_history_credentials_organization_id_organizations_id_f FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: customer_history_credentials customer_history_credentials_pin_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_history_credentials
    ADD CONSTRAINT customer_history_credentials_pin_created_by_user_id_users_id_fk FOREIGN KEY (pin_created_by_user_id) REFERENCES public.users(id);


--
-- Name: customer_history_sessions customer_history_sessions_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_history_sessions
    ADD CONSTRAINT customer_history_sessions_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_history_sessions customer_history_sessions_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customer_history_sessions
    ADD CONSTRAINT customer_history_sessions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: customers customers_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: hardware_agents hardware_agents_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_agents
    ADD CONSTRAINT hardware_agents_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: hardware_agents hardware_agents_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_agents
    ADD CONSTRAINT hardware_agents_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: hardware_agents hardware_agents_register_id_registers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_agents
    ADD CONSTRAINT hardware_agents_register_id_registers_id_fk FOREIGN KEY (register_id) REFERENCES public.registers(id);


--
-- Name: hardware_job_attempts hardware_job_attempts_agent_id_hardware_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_job_attempts
    ADD CONSTRAINT hardware_job_attempts_agent_id_hardware_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.hardware_agents(id);


--
-- Name: hardware_job_attempts hardware_job_attempts_job_id_hardware_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_job_attempts
    ADD CONSTRAINT hardware_job_attempts_job_id_hardware_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.hardware_jobs(id) ON DELETE CASCADE;


--
-- Name: hardware_job_resolutions hardware_job_resolutions_attempt_id_hardware_job_attempts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_job_resolutions
    ADD CONSTRAINT hardware_job_resolutions_attempt_id_hardware_job_attempts_id_fk FOREIGN KEY (attempt_id) REFERENCES public.hardware_job_attempts(id) ON DELETE SET NULL;


--
-- Name: hardware_job_resolutions hardware_job_resolutions_job_id_hardware_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_job_resolutions
    ADD CONSTRAINT hardware_job_resolutions_job_id_hardware_jobs_id_fk FOREIGN KEY (job_id) REFERENCES public.hardware_jobs(id) ON DELETE CASCADE;


--
-- Name: hardware_job_resolutions hardware_job_resolutions_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_job_resolutions
    ADD CONSTRAINT hardware_job_resolutions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: hardware_job_resolutions hardware_job_resolutions_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_job_resolutions
    ADD CONSTRAINT hardware_job_resolutions_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: hardware_job_resolutions hardware_job_resolutions_resolved_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_job_resolutions
    ADD CONSTRAINT hardware_job_resolutions_resolved_by_user_id_users_id_fk FOREIGN KEY (resolved_by_user_id) REFERENCES public.users(id);


--
-- Name: hardware_jobs hardware_jobs_agent_id_hardware_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_jobs
    ADD CONSTRAINT hardware_jobs_agent_id_hardware_agents_id_fk FOREIGN KEY (agent_id) REFERENCES public.hardware_agents(id);


--
-- Name: hardware_jobs hardware_jobs_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_jobs
    ADD CONSTRAINT hardware_jobs_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: hardware_jobs hardware_jobs_current_attempt_id_hardware_job_attempts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_jobs
    ADD CONSTRAINT hardware_jobs_current_attempt_id_hardware_job_attempts_id_fk FOREIGN KEY (current_attempt_id) REFERENCES public.hardware_job_attempts(id) ON DELETE SET NULL;


--
-- Name: hardware_jobs hardware_jobs_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_jobs
    ADD CONSTRAINT hardware_jobs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: hardware_jobs hardware_jobs_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_jobs
    ADD CONSTRAINT hardware_jobs_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: hardware_jobs hardware_jobs_register_id_registers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_jobs
    ADD CONSTRAINT hardware_jobs_register_id_registers_id_fk FOREIGN KEY (register_id) REFERENCES public.registers(id);


--
-- Name: hardware_jobs hardware_jobs_target_agent_id_hardware_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.hardware_jobs
    ADD CONSTRAINT hardware_jobs_target_agent_id_hardware_agents_id_fk FOREIGN KEY (target_agent_id) REFERENCES public.hardware_agents(id);


--
-- Name: inventory_movements inventory_movements_approved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_approved_by_users_id_fk FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: inventory_movements inventory_movements_from_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_from_outlet_id_outlets_id_fk FOREIGN KEY (from_outlet_id) REFERENCES public.outlets(id);


--
-- Name: inventory_movements inventory_movements_item_id_product_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_item_id_product_items_id_fk FOREIGN KEY (item_id) REFERENCES public.product_items(id);


--
-- Name: inventory_movements inventory_movements_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: inventory_movements inventory_movements_performed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_performed_by_users_id_fk FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: inventory_movements inventory_movements_to_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_to_outlet_id_outlets_id_fk FOREIGN KEY (to_outlet_id) REFERENCES public.outlets(id);


--
-- Name: manual_payment_policies manual_payment_policies_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.manual_payment_policies
    ADD CONSTRAINT manual_payment_policies_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: manual_payment_profiles manual_payment_profiles_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.manual_payment_profiles
    ADD CONSTRAINT manual_payment_profiles_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: manual_payment_profiles manual_payment_profiles_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.manual_payment_profiles
    ADD CONSTRAINT manual_payment_profiles_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: manual_payment_profiles manual_payment_profiles_register_id_registers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.manual_payment_profiles
    ADD CONSTRAINT manual_payment_profiles_register_id_registers_id_fk FOREIGN KEY (register_id) REFERENCES public.registers(id) ON DELETE SET NULL;


--
-- Name: metal_price_rates metal_price_rates_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.metal_price_rates
    ADD CONSTRAINT metal_price_rates_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: metal_price_rates metal_price_rates_metal_purity_id_metal_purities_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.metal_price_rates
    ADD CONSTRAINT metal_price_rates_metal_purity_id_metal_purities_id_fk FOREIGN KEY (metal_purity_id) REFERENCES public.metal_purities(id);


--
-- Name: metal_purities metal_purities_metal_id_metals_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.metal_purities
    ADD CONSTRAINT metal_purities_metal_id_metals_id_fk FOREIGN KEY (metal_id) REFERENCES public.metals(id);


--
-- Name: metals metals_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.metals
    ADD CONSTRAINT metals_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: notification_events notification_events_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.notification_events
    ADD CONSTRAINT notification_events_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: notification_events notification_events_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.notification_events
    ADD CONSTRAINT notification_events_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: notification_recipients notification_recipients_event_id_notification_events_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.notification_recipients
    ADD CONSTRAINT notification_recipients_event_id_notification_events_id_fk FOREIGN KEY (event_id) REFERENCES public.notification_events(id) ON DELETE CASCADE;


--
-- Name: notification_recipients notification_recipients_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.notification_recipients
    ADD CONSTRAINT notification_recipients_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: notifications notifications_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: notifications notifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: outlets outlets_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.outlets
    ADD CONSTRAINT outlets_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: payment_evidence_uploads payment_evidence_uploads_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_evidence_uploads
    ADD CONSTRAINT payment_evidence_uploads_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: payment_evidence_uploads payment_evidence_uploads_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_evidence_uploads
    ADD CONSTRAINT payment_evidence_uploads_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: payment_evidence_uploads payment_evidence_uploads_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_evidence_uploads
    ADD CONSTRAINT payment_evidence_uploads_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id);


--
-- Name: payment_evidence_uploads payment_evidence_uploads_uploaded_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_evidence_uploads
    ADD CONSTRAINT payment_evidence_uploads_uploaded_by_users_id_fk FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: payment_reconciliations payment_reconciliations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_reconciliations
    ADD CONSTRAINT payment_reconciliations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: payment_reconciliations payment_reconciliations_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_reconciliations
    ADD CONSTRAINT payment_reconciliations_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: payment_reconciliations payment_reconciliations_payment_id_payments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_reconciliations
    ADD CONSTRAINT payment_reconciliations_payment_id_payments_id_fk FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;


--
-- Name: payment_reconciliations payment_reconciliations_reconciled_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_reconciliations
    ADD CONSTRAINT payment_reconciliations_reconciled_by_users_id_fk FOREIGN KEY (reconciled_by) REFERENCES public.users(id);


--
-- Name: payment_reconciliations payment_reconciliations_resolved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_reconciliations
    ADD CONSTRAINT payment_reconciliations_resolved_by_users_id_fk FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: payment_refunds payment_refunds_approval_id_approvals_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_approval_id_approvals_id_fk FOREIGN KEY (approval_id) REFERENCES public.approvals(id);


--
-- Name: payment_refunds payment_refunds_approved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_approved_by_users_id_fk FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: payment_refunds payment_refunds_confirmed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_confirmed_by_users_id_fk FOREIGN KEY (confirmed_by) REFERENCES public.users(id);


--
-- Name: payment_refunds payment_refunds_executed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_executed_by_users_id_fk FOREIGN KEY (executed_by) REFERENCES public.users(id);


--
-- Name: payment_refunds payment_refunds_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: payment_refunds payment_refunds_original_shift_id_shifts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_original_shift_id_shifts_id_fk FOREIGN KEY (original_shift_id) REFERENCES public.shifts(id);


--
-- Name: payment_refunds payment_refunds_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: payment_refunds payment_refunds_payment_id_payments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_payment_id_payments_id_fk FOREIGN KEY (payment_id) REFERENCES public.payments(id);


--
-- Name: payment_refunds payment_refunds_refund_shift_id_shifts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_refund_shift_id_shifts_id_fk FOREIGN KEY (refund_shift_id) REFERENCES public.shifts(id);


--
-- Name: payment_refunds payment_refunds_requested_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_requested_by_users_id_fk FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: payment_refunds payment_refunds_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id);


--
-- Name: payments payments_co_verified_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_co_verified_by_users_id_fk FOREIGN KEY (co_verified_by) REFERENCES public.users(id);


--
-- Name: payments payments_manual_payment_profile_id_manual_payment_profiles_id_f; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_manual_payment_profile_id_manual_payment_profiles_id_f FOREIGN KEY (manual_payment_profile_id) REFERENCES public.manual_payment_profiles(id) ON DELETE SET NULL;


--
-- Name: payments payments_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id);


--
-- Name: payments payments_verification_approval_id_approvals_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_verification_approval_id_approvals_id_fk FOREIGN KEY (verification_approval_id) REFERENCES public.approvals(id);


--
-- Name: payments payments_verified_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_verified_by_users_id_fk FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: pos_checkout_attempts pos_checkout_attempts_cashier_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_checkout_attempts
    ADD CONSTRAINT pos_checkout_attempts_cashier_id_users_id_fk FOREIGN KEY (cashier_id) REFERENCES public.users(id);


--
-- Name: pos_checkout_attempts pos_checkout_attempts_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_checkout_attempts
    ADD CONSTRAINT pos_checkout_attempts_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: pos_checkout_attempts pos_checkout_attempts_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_checkout_attempts
    ADD CONSTRAINT pos_checkout_attempts_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: pos_checkout_attempts pos_checkout_attempts_register_id_registers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_checkout_attempts
    ADD CONSTRAINT pos_checkout_attempts_register_id_registers_id_fk FOREIGN KEY (register_id) REFERENCES public.registers(id);


--
-- Name: pos_checkout_attempts pos_checkout_attempts_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_checkout_attempts
    ADD CONSTRAINT pos_checkout_attempts_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


--
-- Name: pos_checkout_attempts pos_checkout_attempts_shift_id_shifts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_checkout_attempts
    ADD CONSTRAINT pos_checkout_attempts_shift_id_shifts_id_fk FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: pos_held_cart_items pos_held_cart_items_held_cart_id_pos_held_carts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_held_cart_items
    ADD CONSTRAINT pos_held_cart_items_held_cart_id_pos_held_carts_id_fk FOREIGN KEY (held_cart_id) REFERENCES public.pos_held_carts(id);


--
-- Name: pos_held_cart_items pos_held_cart_items_product_item_id_product_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_held_cart_items
    ADD CONSTRAINT pos_held_cart_items_product_item_id_product_items_id_fk FOREIGN KEY (product_item_id) REFERENCES public.product_items(id);


--
-- Name: pos_held_carts pos_held_carts_canceled_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_held_carts
    ADD CONSTRAINT pos_held_carts_canceled_by_user_id_users_id_fk FOREIGN KEY (canceled_by_user_id) REFERENCES public.users(id);


--
-- Name: pos_held_carts pos_held_carts_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_held_carts
    ADD CONSTRAINT pos_held_carts_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: pos_held_carts pos_held_carts_held_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_held_carts
    ADD CONSTRAINT pos_held_carts_held_by_user_id_users_id_fk FOREIGN KEY (held_by_user_id) REFERENCES public.users(id);


--
-- Name: pos_held_carts pos_held_carts_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_held_carts
    ADD CONSTRAINT pos_held_carts_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: pos_held_carts pos_held_carts_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_held_carts
    ADD CONSTRAINT pos_held_carts_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: pos_held_carts pos_held_carts_register_id_registers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_held_carts
    ADD CONSTRAINT pos_held_carts_register_id_registers_id_fk FOREIGN KEY (register_id) REFERENCES public.registers(id);


--
-- Name: pos_held_carts pos_held_carts_resumed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_held_carts
    ADD CONSTRAINT pos_held_carts_resumed_by_user_id_users_id_fk FOREIGN KEY (resumed_by_user_id) REFERENCES public.users(id);


--
-- Name: pos_held_carts pos_held_carts_shift_id_shifts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.pos_held_carts
    ADD CONSTRAINT pos_held_carts_shift_id_shifts_id_fk FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: product_categories product_categories_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: product_categories product_categories_parent_category_id_product_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_parent_category_id_product_categories_id_fk FOREIGN KEY (parent_category_id) REFERENCES public.product_categories(id);


--
-- Name: product_items product_items_current_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.product_items
    ADD CONSTRAINT product_items_current_outlet_id_outlets_id_fk FOREIGN KEY (current_outlet_id) REFERENCES public.outlets(id);


--
-- Name: product_items product_items_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.product_items
    ADD CONSTRAINT product_items_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: product_items product_items_product_master_id_product_masters_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.product_items
    ADD CONSTRAINT product_items_product_master_id_product_masters_id_fk FOREIGN KEY (product_master_id) REFERENCES public.product_masters(id);


--
-- Name: product_masters product_masters_category_id_product_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.product_masters
    ADD CONSTRAINT product_masters_category_id_product_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.product_categories(id);


--
-- Name: product_masters product_masters_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.product_masters
    ADD CONSTRAINT product_masters_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: registers registers_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.registers
    ADD CONSTRAINT registers_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: role_permissions role_permissions_permission_id_permissions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_permissions_id_fk FOREIGN KEY (permission_id) REFERENCES public.permissions(id);


--
-- Name: role_permissions role_permissions_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: roles roles_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: sale_items sale_items_product_item_id_product_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_product_item_id_product_items_id_fk FOREIGN KEY (product_item_id) REFERENCES public.product_items(id);


--
-- Name: sale_items sale_items_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id);


--
-- Name: sale_return_cases sale_return_cases_approval_id_approvals_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_return_cases
    ADD CONSTRAINT sale_return_cases_approval_id_approvals_id_fk FOREIGN KEY (approval_id) REFERENCES public.approvals(id);


--
-- Name: sale_return_cases sale_return_cases_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_return_cases
    ADD CONSTRAINT sale_return_cases_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: sale_return_cases sale_return_cases_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_return_cases
    ADD CONSTRAINT sale_return_cases_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: sale_return_cases sale_return_cases_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_return_cases
    ADD CONSTRAINT sale_return_cases_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: sale_return_cases sale_return_cases_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_return_cases
    ADD CONSTRAINT sale_return_cases_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id);


--
-- Name: sale_return_items sale_return_items_decided_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_return_items
    ADD CONSTRAINT sale_return_items_decided_by_users_id_fk FOREIGN KEY (decided_by) REFERENCES public.users(id);


--
-- Name: sale_return_items sale_return_items_inspected_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_return_items
    ADD CONSTRAINT sale_return_items_inspected_by_users_id_fk FOREIGN KEY (inspected_by) REFERENCES public.users(id);


--
-- Name: sale_return_items sale_return_items_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_return_items
    ADD CONSTRAINT sale_return_items_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: sale_return_items sale_return_items_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_return_items
    ADD CONSTRAINT sale_return_items_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: sale_return_items sale_return_items_product_item_id_product_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_return_items
    ADD CONSTRAINT sale_return_items_product_item_id_product_items_id_fk FOREIGN KEY (product_item_id) REFERENCES public.product_items(id);


--
-- Name: sale_return_items sale_return_items_received_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_return_items
    ADD CONSTRAINT sale_return_items_received_by_users_id_fk FOREIGN KEY (received_by) REFERENCES public.users(id);


--
-- Name: sale_return_items sale_return_items_return_case_id_sale_return_cases_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_return_items
    ADD CONSTRAINT sale_return_items_return_case_id_sale_return_cases_id_fk FOREIGN KEY (return_case_id) REFERENCES public.sale_return_cases(id);


--
-- Name: sale_return_items sale_return_items_sale_item_id_sale_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sale_return_items
    ADD CONSTRAINT sale_return_items_sale_item_id_sale_items_id_fk FOREIGN KEY (sale_item_id) REFERENCES public.sale_items(id);


--
-- Name: sales sales_cashier_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_cashier_id_users_id_fk FOREIGN KEY (cashier_id) REFERENCES public.users(id);


--
-- Name: sales sales_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: sales sales_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: sales sales_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: sales sales_register_id_registers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_register_id_registers_id_fk FOREIGN KEY (register_id) REFERENCES public.registers(id);


--
-- Name: sales sales_shift_id_shifts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_shift_id_shifts_id_fk FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: settlement_import_batches settlement_import_batches_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.settlement_import_batches
    ADD CONSTRAINT settlement_import_batches_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: settlement_import_batches settlement_import_batches_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.settlement_import_batches
    ADD CONSTRAINT settlement_import_batches_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: settlement_import_batches settlement_import_batches_profile_id_manual_payment_profiles_id; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.settlement_import_batches
    ADD CONSTRAINT settlement_import_batches_profile_id_manual_payment_profiles_id FOREIGN KEY (profile_id) REFERENCES public.manual_payment_profiles(id);


--
-- Name: settlement_import_batches settlement_import_batches_uploaded_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.settlement_import_batches
    ADD CONSTRAINT settlement_import_batches_uploaded_by_users_id_fk FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: settlement_import_mappings settlement_import_mappings_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.settlement_import_mappings
    ADD CONSTRAINT settlement_import_mappings_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: settlement_import_mappings settlement_import_mappings_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.settlement_import_mappings
    ADD CONSTRAINT settlement_import_mappings_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: settlement_import_mappings settlement_import_mappings_profile_id_manual_payment_profiles_i; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.settlement_import_mappings
    ADD CONSTRAINT settlement_import_mappings_profile_id_manual_payment_profiles_i FOREIGN KEY (profile_id) REFERENCES public.manual_payment_profiles(id) ON DELETE CASCADE;


--
-- Name: settlement_import_mappings settlement_import_mappings_updated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.settlement_import_mappings
    ADD CONSTRAINT settlement_import_mappings_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: settlement_import_rows settlement_import_rows_batch_id_settlement_import_batches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.settlement_import_rows
    ADD CONSTRAINT settlement_import_rows_batch_id_settlement_import_batches_id_fk FOREIGN KEY (batch_id) REFERENCES public.settlement_import_batches(id) ON DELETE CASCADE;


--
-- Name: settlement_import_rows settlement_import_rows_matched_payment_id_payments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.settlement_import_rows
    ADD CONSTRAINT settlement_import_rows_matched_payment_id_payments_id_fk FOREIGN KEY (matched_payment_id) REFERENCES public.payments(id);


--
-- Name: shifts shifts_closed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_closed_by_users_id_fk FOREIGN KEY (closed_by) REFERENCES public.users(id);


--
-- Name: shifts shifts_opened_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_opened_by_users_id_fk FOREIGN KEY (opened_by) REFERENCES public.users(id);


--
-- Name: shifts shifts_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: shifts shifts_register_id_registers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_register_id_registers_id_fk FOREIGN KEY (register_id) REFERENCES public.registers(id);


--
-- Name: user_outlets user_outlets_outlet_id_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.user_outlets
    ADD CONSTRAINT user_outlets_outlet_id_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.outlets(id);


--
-- Name: user_outlets user_outlets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.user_outlets
    ADD CONSTRAINT user_outlets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_assigned_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_users_id_fk FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: user_roles user_roles_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_sessions user_sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: asihjaya
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- PostgreSQL database dump complete
--

\unrestrict I4oEoBPSHkH0r39r1jxoeuwzrDfgsJb9Wc4UJ4v5eQtufANxaAj41QijTXo9FEg

