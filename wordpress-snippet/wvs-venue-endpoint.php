<?php
/**
 * WVS Portal — Custom REST endpoints
 * REEMPLAZA TODO EL CONTENIDO ANTIGUO EN functions.php CON ESTE SNIPPET.
 *
 * GET  /wp-json/wvs/v1/venue/{id}          → leer todos los campos ACF
 * POST /wp-json/wvs/v1/venue/{id}/update   → actualizar campos ACF + post
 * POST /wp-json/wvs/v1/venue/create        → crear nuevo venue con ACF
 */

if ( ! defined('WVS_REST_TOKEN') ) {
    define('WVS_REST_TOKEN', 'wvs_k9mP3xR7qL2nT5vB8cD6hJ4wvs');
}

if ( ! function_exists('wvs_check_token') ) :
function wvs_check_token( WP_REST_Request $req ): bool {
    return $req->get_header('X-WVS-Token') === WVS_REST_TOKEN;
}
endif;

// ── Sideload a URL into WP media library (reuses existing if already sideloaded) ─
if ( ! function_exists('wvs_get_or_sideload_image') ) :
function wvs_get_or_sideload_image( string $url, int $post_id ): ?int {
    if ( empty( $url ) || ! filter_var( $url, FILTER_VALIDATE_URL ) ) return null;

    // Return existing attachment if already sideloaded from this URL
    $existing = get_posts( array(
        'post_type'      => 'attachment',
        'post_status'    => 'any',
        'posts_per_page' => 1,
        'fields'         => 'ids',
        'meta_query'     => array( array( 'key' => '_wvs_source_url', 'value' => $url ) ),
    ) );
    if ( ! empty( $existing ) ) return (int) $existing[0];

    // Load media functions if not already available
    if ( ! function_exists( 'media_sideload_image' ) ) {
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
    }

    // REST API callbacks have no active user — set one so wp_insert_attachment works
    if ( ! get_current_user_id() ) {
        $admins = get_users( array( 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ) );
        if ( ! empty( $admins ) ) {
            wp_set_current_user( (int) $admins[0] );
        }
    }

    $attachment_id = media_sideload_image( $url, $post_id, '', 'id' );

    if ( is_wp_error( $attachment_id ) ) {
        error_log( '[WVS] sideload failed for ' . $url . ': ' . $attachment_id->get_error_message() );
        return null;
    }

    update_post_meta( (int) $attachment_id, '_wvs_source_url', $url );
    return (int) $attachment_id;
}
endif;

// ── Helper: update ACF fields, sideloading images where needed ────────────────
if ( ! function_exists('wvs_update_acf_fields') ) :
function wvs_update_acf_fields( array $acf, int $post_id ): void {

    // Single-image ACF fields (store one attachment ID via update_field)
    $image_fields = array(
        'h1_image', 'vertical_photo',
        'h2_gallery', 'h2_gallery_copy', 'h2_gallery_copy2', 'h2_gallery_copy3',
        'h2_gallery_copy4', 'h2_gallery_copy5', 'h2_gallery_copy6', 'h2_gallery_copy7',
    );

    foreach ( $acf as $field_name => $value ) {
        // section_2_image es Photo Gallery — usamos update_post_meta directamente
        // para evitar que ACF serialice el valor y cause un crash al renderizar
        if ( $field_name === 'section_2_image' ) {
            if ( is_string( $value ) && filter_var( $value, FILTER_VALIDATE_URL ) ) {
                $att_id = wvs_get_or_sideload_image( $value, $post_id );
                if ( $att_id ) update_post_meta( $post_id, 'section_2_image', $att_id );
            }
            continue;
        }

        if ( in_array( $field_name, $image_fields, true )
             && is_string( $value )
             && filter_var( $value, FILTER_VALIDATE_URL ) ) {
            $att_id = wvs_get_or_sideload_image( $value, $post_id );
            update_field( $field_name, $att_id ? $att_id : '', $post_id );
        } else {
            update_field( $field_name, $value, $post_id );
        }
    }
}
endif;

add_action('rest_api_init', function () {

    // ── GET: leer venue ────────────────────────────────────────────────────────
    register_rest_route('wvs/v1', '/venue/(?P<id>\d+)', array(
        'methods'             => 'GET',
        'permission_callback' => '__return_true',
        'callback'            => function (WP_REST_Request $req) {
            $id   = (int) $req['id'];
            $post = get_post($id);
            if (! $post) {
                return new WP_Error('not_found', 'Venue not found', array('status' => 404));
            }
            return rest_ensure_response(array(
                'id'    => $id,
                'title' => array('rendered' => get_the_title($id)),
                'link'  => get_permalink($id),
                'status'=> $post->post_status,
                'excerpt' => array('rendered' => get_the_excerpt($post)),
                'content' => array('rendered' => apply_filters('the_content', $post->post_content)),
                'acf'   => array(
                    'H1_Venue'                              => get_field('H1_Venue', $id),
                    'location'                              => get_field('location', $id),
                    'Short_Description_of_Venue'            => get_field('Short_Description_of_Venue', $id),
                    'venue_starting_price'                  => get_field('venue_starting_price', $id),
                    'Capacity_of_Venue'                     => get_field('Capacity_of_Venue', $id),
                    'accommodation'                         => get_field('accommodation', $id),
                    'Min_Nights_of_Venue'                   => get_field('Min_Nights_of_Venue', $id),
                    'wvs_accommodation_help'                => get_field('wvs_accommodation_help', $id),
                    'h1_image'                              => get_field('h1_image', $id),
                    'vertical_photo'                        => get_field('vertical_photo', $id),
                    'section_2_image'                       => get_field('section_2_image', $id),
                    'h2_gallery'                            => get_field('h2_gallery', $id),
                    'h2_gallery_copy'                       => get_field('h2_gallery_copy', $id),
                    'h2_gallery_copy2'                      => get_field('h2_gallery_copy2', $id),
                    'h2_gallery_copy3'                      => get_field('h2_gallery_copy3', $id),
                    'h2_gallery_copy4'                      => get_field('h2_gallery_copy4', $id),
                    'h2_gallery_copy5'                      => get_field('h2_gallery_copy5', $id),
                    'h2_gallery_copy6'                      => get_field('h2_gallery_copy6', $id),
                    'h2_gallery_copy7'                      => get_field('h2_gallery_copy7', $id),
                    'h2-Venue_and_mini_description'         => get_field('h2-Venue_and_mini_description', $id),
                    'mini_paragraph'                        => get_field('mini_paragraph', $id),
                    'start_of_post_content'                 => get_field('start_of_post_content', $id),
                    'starting_price_breakdown1'             => get_field('starting_price_breakdown1', $id),
                    'starting_price_breakdown_text_area_1'  => get_field('starting_price_breakdown_text_area_1', $id),
                    'starting_price_breakdown_3'            => get_field('starting_price_breakdown_3', $id),
                    'starting_price_breakdown_text_area_3'  => get_field('starting_price_breakdown_text_area_3', $id),
                    'catering_and_drinks_description'       => get_field('catering_and_drinks_description', $id),
                    'starting_price_breakdown_4'            => get_field('starting_price_breakdown_4', $id),
                    'starting_price_breakdown_text_area_4'  => get_field('starting_price_breakdown_text_area_4', $id),
                    'Specific_Location'                     => get_field('Specific_Location', $id),
                    'Places_Nearby'                         => get_field('Places_Nearby', $id),
                    'Closest_Airport_to_Venue'              => get_field('Closest_Airport_to_Venue', $id),
                    'reviews_enabled'                       => get_field('reviews_enabled', $id),
                    'reviews'                               => get_field('reviews', $id),
                    'testimonial_1'                         => get_field('testimonial_1', $id),
                    'testimonial_name_1'                    => get_field('testimonial_name_1', $id),
                    'testimonial_country_1'                 => get_field('testimonial_country_1', $id),
                    'testimonial_2'                         => get_field('testimonial_2', $id),
                    'testimonial_name_2'                    => get_field('testimonial_name_2', $id),
                    'testimonial_country_2'                 => get_field('testimonial_country_2', $id),
                    'testimonial_3'                         => get_field('testimonial_3', $id),
                    'testimonial_name_3'                    => get_field('testimonial_name_3', $id),
                    'testimonial_country_3'                 => get_field('testimonial_country_3', $id),
                    'email_del_venue'                       => get_field('email_del_venue', $id),
                ),
            ));
        },
    ));

    // ── POST: actualizar venue existente ───────────────────────────────────────
    register_rest_route('wvs/v1', '/venue/(?P<id>\d+)/update', array(
        'methods'             => 'POST',
        'permission_callback' => 'wvs_check_token',
        'callback'            => function (WP_REST_Request $req) {
            $id     = (int) $req['id'];
            $params = $req->get_json_params();

            $post_data = array('ID' => $id, 'post_status' => 'publish');
            if (isset($params['title'])) {
                $post_data['post_title'] = sanitize_text_field($params['title']);
                $post_data['post_name']  = sanitize_title($params['title']);
            }
            if (isset($params['content'])) $post_data['post_content'] = wp_kses_post($params['content']);
            if (isset($params['excerpt'])) $post_data['post_excerpt'] = sanitize_textarea_field($params['excerpt']);
            wp_update_post($post_data);

            if (! empty($params['acf']) && is_array($params['acf'])) {
                wvs_update_acf_fields($params['acf'], $id);
            }

            return rest_ensure_response(array('success' => true, 'id' => $id));
        },
    ));

    // ── POST: crear venue nuevo ────────────────────────────────────────────────
    register_rest_route('wvs/v1', '/venue/create', array(
        'methods'             => 'POST',
        'permission_callback' => 'wvs_check_token',
        'callback'            => function (WP_REST_Request $req) {
            $params = $req->get_json_params();

            $post_id = wp_insert_post(array(
                'post_type'    => 'wedding-venues',
                'post_status'  => 'publish',
                'post_title'   => sanitize_text_field($params['title']    ?? ''),
                'post_name'    => sanitize_title($params['title']          ?? ''),
                'post_content' => wp_kses_post($params['content']         ?? ''),
                'post_excerpt' => sanitize_textarea_field($params['excerpt'] ?? ''),
            ), true);

            if (is_wp_error($post_id)) {
                return new WP_Error('insert_failed', $post_id->get_error_message(), array('status' => 500));
            }

            if (! empty($params['acf']) && is_array($params['acf'])) {
                wvs_update_acf_fields($params['acf'], $post_id);
            }

            return rest_ensure_response(array('success' => true, 'id' => $post_id));
        },
    ));

});

// ── Forminator: enviar email al venue cuando recibe un lead ───────────────────
// wp_loaded dispara en todas las requests (incluyendo AJAX) y tiene $_POST disponible.
add_action( 'wp_loaded', function () {
    if ( ! function_exists( 'get_field' ) ) return;

    // Solo requests AJAX con acción de Forminator
    if ( empty( $_POST['action'] ) ) return;
    if ( strpos( $_POST['action'], 'forminator' ) === false ) return;

    // Leer datos del formulario
    $post_data = array();
    if ( isset( $_POST['data'] ) && is_array( $_POST['data'] ) ) {
        $post_data = $_POST['data'];
    } elseif ( isset( $_POST['data'] ) && is_string( $_POST['data'] ) ) {
        $decoded = json_decode( stripslashes( $_POST['data'] ), true );
        if ( is_array( $decoded ) ) $post_data = $decoded;
    }

    // Fallback: leer del cuerpo raw (JSON body)
    if ( empty( $post_data ) ) {
        $raw = file_get_contents( 'php://input' );
        if ( ! empty( $raw ) ) {
            $json = json_decode( $raw, true );
            if ( isset( $json['data'] ) && is_array( $json['data'] ) ) {
                $post_data = $json['data'];
            } else {
                parse_str( $raw, $parsed );
                if ( isset( $parsed['data'] ) && is_array( $parsed['data'] ) ) {
                    $post_data = $parsed['data'];
                }
            }
        }
    }

    if ( empty( $post_data ) ) return;

    // Buscar campo hidden con el post ID del venue
    $venue_id = 0;
    foreach ( $post_data as $field ) {
        $name  = isset( $field['name'] )  ? $field['name']  : '';
        $value = isset( $field['value'] ) ? $field['value'] : '';
        if ( strpos( $name, 'hidden' ) !== false && is_numeric( $value ) && intval( $value ) > 0 ) {
            $venue_id = intval( $value );
            break;
        }
    }

    if ( ! $venue_id ) return;

    $emails_raw = get_field( 'email_del_venue', $venue_id );
    if ( ! $emails_raw ) return;

    $emails = array_filter( array_map( 'trim', explode( ',', $emails_raw ) ), 'is_email' );
    $emails = array_slice( $emails, 0, 5 );
    if ( empty( $emails ) ) return;

    $skip = array( 'submit-1', 'consent-1', 'captcha-1', 'gdpr-1' );
    $lead_lines = array();
    foreach ( $post_data as $field ) {
        $name  = isset( $field['name'] )  ? $field['name']  : '';
        $value = isset( $field['value'] ) ? $field['value'] : '';
        if ( strpos( $name, 'hidden' ) !== false ) continue;
        if ( in_array( $name, $skip, true ) ) continue;
        if ( $value !== '' && $value !== null ) {
            $lead_lines[] = ucfirst( str_replace( '-', ' ', $name ) ) . ': ' . sanitize_text_field( $value );
        }
    }

    $venue_title = get_the_title( $venue_id );
    $body  = "Has recibido una nueva consulta para {$venue_title} a través de Wedding Venues Spain:\n\n";
    $body .= implode( "\n", $lead_lines );
    $body .= "\n\n---\nWedding Venues Spain · weddingvenuesspain.com";

    add_action( 'shutdown', function () use ( $emails, $body ) {
        foreach ( $emails as $email ) {
            wp_mail( $email, 'Nueva consulta recibida - Wedding Venues Spain', $body );
        }
    } );
} );
