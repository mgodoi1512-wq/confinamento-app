/** Paginação com ordem estável; falha se qualquer página não puder ser lida. */
export const fetchAll = async <T>(makeQuery: () => {
  range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
}): Promise<T[]> => {
  const rows: T[] = [];
  // 200 fica abaixo do limite padrão do serviço. Não encerrar por página curta:
  // o servidor pode ter um limite configurado ainda menor.
  for (;;) {
    const { data, error } = await makeQuery().range(rows.length, rows.length + 199);
    if (error) throw new Error(error.message);
    if (!data?.length) return rows;
    rows.push(...data as T[]);
  }
};
