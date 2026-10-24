-- SOMENTE LEITURA. Registros de migração não provam execução correta do conteúdo.
-- Instaladas manualmente no SQL Editor podem não aparecer nesse histórico.
-- Execute a primeira consulta. Se historico_existe=false, não execute a segunda.
select to_regclass('supabase_migrations.schema_migrations') is not null as historico_existe;

-- Segunda consulta: execute apenas se o histórico existir.
with esperadas(versao,arquivo) as (values
('20261010173428','20261010173428_schema_base.sql'),
('20261010173434','20261010173434_enable_rls.sql'),
('20261012220000','20261012220000_integrity_and_access.sql'),
('20261013010000','20261013010000_weight_record_corrections.sql'),
('20261013020000','20261013020000_edit_weight_only.sql'),
('20261013030000','20261013030000_trough_application_feedback.sql'),
('20261014010000','20261014010000_multi_farm.sql'),
('20261015020000','20261015020000_diet_body_weight_percentage.sql'),
('20261015030000','20261015030000_active_and_unique_diets.sql'),
('20261015040000','20261015040000_adaptation_plans.sql'),
('20261015050000','20261015050000_adaptation_plan_actions.sql'),
('20261015060000','20261015060000_beta_feedback.sql'),
('20261015070000','20261015070000_require_pen_for_new_lot.sql'),
('20261015080000','20261015080000_executor_auth_context.sql'),
('20261015090000','20261015090000_health_event_local_date.sql'),
('20261015100000','20261015100000_finance_cost_sheets.sql'),
('20261016010000','20261016010000_default_adaptation_diets.sql'),
('20261016020000','20261016020000_daily_feed_plans.sql'),
('20261016030000','20261016030000_feed_periods_only.sql'),
('20261016040000','20261016040000_flexible_daily_feed_count.sql'),
('20261017010000','20261017010000_platform_billing_controls.sql'),
('20261017020000','20261017020000_sandbox_my_plan.sql'),
('20261017030000','20261017030000_sandbox_payment_webhook.sql'),
('20261017040000','20261017040000_sandbox_subscriptions.sql'),
('20261017050000','20261017050000_production_billing.sql'),
('20261018010000','20261018010000_annual_installments.sql'),
('20261018020000','20261018020000_plan_presentation.sql'),
('20261018030000','20261018030000_signup_contact_phone.sql'),
('20261018040000','20261018040000_ear_tags_per_lot.sql'),
('20261018050000','20261018050000_lot_ear_tag_precheck.sql'),
('20261018060000','20261018060000_cash_flow_inventory.sql'),
('20261018070000','20261018070000_separate_cash_stock_settings.sql'),
('20261018080000','20261018080000_stock_animal_purchase_values.sql'),
('20261018090000','20261018090000_create_lot_with_purchase.sql'),
('20261018100000','20261018100000_register_lot_animals.sql'),
('20261018110000','20261018110000_cash_loans.sql'),
('20261018120000','20261018120000_equipment_inventory.sql'),
('20261018130000','20261018130000_stock_feed_production.sql'),
('20261018140000','20261018140000_diet_feed_stock_integration.sql'),
('20261018150000','20261018150000_farm_production_systems.sql'),
('20261018160000','20261018160000_identify_legacy_lots_on_system_selection.sql'),
('20261020020000','20261020020000_pen_operational_status.sql'),
('20261023010000','20261023010000_legal_acceptances.sql'),
('20261024010000','20261024010000_herd_count_integrity.sql'),
('20261024020000','20261024020000_purchase_installments.sql'),
('20261024030000','20261024030000_public_plan_prices.sql')
), instaladas as (select version::text as versao from supabase_migrations.schema_migrations)
select coalesce(e.versao,i.versao) as versao,e.arquivo,
 case when e.versao is null then 'Somente no banco: investigar origem'
      when i.versao is null then 'Sem registro: pode ter sido executada manualmente'
      else 'Versão registrada: conferir estrutura/permissões também' end as situacao
from esperadas e full join instaladas i on i.versao=e.versao
order by coalesce(e.versao,i.versao),e.arquivo;
