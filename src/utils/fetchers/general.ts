import { User } from "@supabase/supabase-js";
import { createClient } from "../supabase/client";

const supabase = createClient();

interface IGetCurrentUserPhoneAndOrganizationIdProps {
    user?: {
        user: User
    },
}

const isAdminOrOwner = true;

export const generalHelpers = {
    async getCurrentUserPhoneAndOrganizationId(props?: IGetCurrentUserPhoneAndOrganizationIdProps) {
        // get user data profile and organization id, for web using.
        const userData = props?.user || (await supabase.auth.getUser()).data;
        if (!userData.user) return { data: null, error: new Error('User not authenticated') };

        if (isAdminOrOwner) {

            const { data: userProfileData, error: userProfileError } = await supabase.from('users').select('phone_number').eq('id', userData.user.id).single();
            if (userProfileError) return { data: null, error: new Error('Error fetching user data') };

            // organization id
            const { data: organizationIdData, error: organizationIdError } = await supabase.from('users').select('organization_id').eq('id', userData.user.id).single();

            return { data: {
                phoneNumber: userProfileData.phone_number,
                organizationId: organizationIdData?.organization_id
            }, error: userProfileError || organizationIdError }; 
        } else {
            const { data: userProfileData, error: userProfileError } = await supabase.from('organization_clients').select('phone').eq('client_id', userData.user.id).single();
            if (userProfileError) return { data: null, error: new Error('Error fetching user data') };

            // organization id
            const { data: organizationIdData, error: organizationIdError } = await supabase.from('organization_clients').select('organization_id').eq('client_id', userData.user.id).single();

            return { data: {
                phoneNumber: userProfileData.phone,
                organizationId: organizationIdData?.organization_id
            }, error: userProfileError || organizationIdError }; 

        }


    }
}