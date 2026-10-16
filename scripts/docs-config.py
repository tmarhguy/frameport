#!/usr/bin/env python3
"""Resolve portable site settings without network access."""
import os
from urllib.parse import urlsplit

def resolve_site(config):
    site = dict(config)
    repository = (site.get('repository') or '').rstrip('/')
    slug = ''
    if repository:
        parsed = urlsplit(repository)
        if parsed.scheme != 'https' or not parsed.netloc:
            raise ValueError('repository must be an absolute HTTPS URL or empty')
        if parsed.netloc == 'github.com':
            slug = parsed.path.strip('/').removesuffix('.git')
    elif os.environ.get('GITHUB_REPOSITORY'):
        slug = os.environ['GITHUB_REPOSITORY']
        repository = 'https://github.com/'+slug
    site['repository'] = repository
    url = os.environ.get('DOCS_SITE_URL') or site.get('url') or ''
    if not url and slug and len(slug.split('/')) == 2:
        owner, repo = slug.split('/')
        url = f'https://{owner}.github.io/'
        if repo.lower() != f'{owner.lower()}.github.io':
            url += repo+'/'
    if url and (urlsplit(url).scheme != 'https' or not urlsplit(url).netloc):
        raise ValueError('url must be an absolute HTTPS URL or empty')
    site['url'] = url.rstrip('/')+'/' if url else ''
    website = site.get('website') or ''
    if website and (urlsplit(website).scheme not in ('http','https') or not urlsplit(website).netloc):
        raise ValueError('website must be an HTTP(S) URL or empty')
    site['website'] = website
    if not site.get('source') and repository:
        site['source'] = repository+'/blob/'+site.get('branch','main')+'/docs/index.adoc'
    return site
