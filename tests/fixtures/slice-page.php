<?php
/**
 * The Milestone-1 page: Section Cards with Text, Toggle and Select fields (mirrors Figma "Settings page").
 * Used by: the PHPUnit contract test, tools/dev/dump-slice.php (→ slice-page.client.json for the static harness),
 * and every e2e demo plugin.
 *
 * @package Fyldo
 */

return array(
	'title'       => 'General',
	'description' => 'Manage your site’s identity, reading and privacy options.',
	'icon'        => 'setting-2',
	'save'        => 'global',
	'sections'    => array(
		array(
			'id'          => 'identity',
			'title'       => 'Site identity',
			'description' => 'How your site appears to visitors and search engines.',
			'fields'      => array(
				array(
					'id'          => 'site_title',
					'type'        => 'text',
					'label'       => 'Site title',
					'description' => 'Shown in the browser tab and in search results.',
					'default'     => 'Fyldo',
					'placeholder' => 'My WordPress site',
					'validate'    => array(
						'required'   => true,
						'max_length' => 60,
					),
				),
				array(
					'id'          => 'tagline',
					'type'        => 'text',
					'label'       => 'Tagline',
					'description' => 'A short sentence that explains what the site is about.',
					'default'     => 'Settings panels for WordPress',
				),
				array(
					'id'          => 'maintenance',
					'type'        => 'toggle',
					'label'       => 'Maintenance mode',
					'description' => 'Show a coming-soon page to visitors. Logged-in admins still see the site.',
					'default'     => false,
				),
			),
		),
		array(
			'id'          => 'language',
			'title'       => 'Language & region',
			'description' => 'Interface language, timezone and time format.',
			'fields'      => array(
				array(
					'id'          => 'language',
					'type'        => 'select',
					'label'       => 'Site language',
					'description' => 'Default language for the interface and emails.',
					'icon'        => 'global',
					'default'     => 'en_US',
					'options'     => array(
						'en_US' => 'English (United States)',
						'fa_IR' => 'فارسی',
						'de_DE' => 'Deutsch',
						'fr_FR' => 'Français',
						'es_ES' => 'Español',
						'tr_TR' => 'Türkçe',
						'ar'    => 'العربية',
					),
				),
				array(
					'id'          => 'timezone',
					'type'        => 'select',
					'label'       => 'Timezone',
					'description' => 'Used to schedule posts and reports.',
					'default'     => 'Asia/Tehran',
					'options'     => array(
						'UTC'            => 'UTC',
						'Europe/London'  => 'London (UTC+00:00)',
						'Europe/Berlin'  => 'Berlin (UTC+01:00)',
						'Asia/Tehran'    => 'Tehran (UTC+03:30)',
						'Asia/Dubai'     => 'Dubai (UTC+04:00)',
						'Asia/Tokyo'     => 'Tokyo (UTC+09:00)',
						'America/New_York' => 'New York (UTC−05:00)',
						'America/Los_Angeles' => 'Los Angeles (UTC−08:00)',
						'Australia/Sydney' => 'Sydney (UTC+11:00)',
						'Pacific/Auckland' => 'Auckland (UTC+13:00)',
					),
				),
				array(
					'id'          => 'time24',
					'type'        => 'toggle',
					'label'       => '24-hour time',
					'description' => 'Show times as 14:30 instead of 2:30 PM.',
					'default'     => true,
				),
			),
		),
	),
);
