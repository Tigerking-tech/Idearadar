import axios from "axios";
import { ApiPricingTableDto } from "@/types/creem";
import config from "@/config";

export const fetchPricingTable =
  async (): Promise<ApiPricingTableDto | null> => {
    const response = await axios.get(`${config.creem.url}/v1/pricing-table/${config.creem.pricingTableId}`);
    return response.data as ApiPricingTableDto;
  };