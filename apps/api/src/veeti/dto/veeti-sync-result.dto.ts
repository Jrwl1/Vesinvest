export class VeetiSyncResultDto {
  linked!: {
    orgId: string;
    veetiId: number;
    nimi: string | null;
    ytunnus: string | null;
  };
  fetchedAt!: string;
  years!: number[];
  snapshotUpserts!: number;
}

